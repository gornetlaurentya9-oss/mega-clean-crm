import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte, or, inArray } from "drizzle-orm";
import { addDays, format, parseISO, getISOWeek, getDate, differenceInCalendarWeeks } from "date-fns";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { jobs, clients, employees, recurringPatterns, jobEmployees, recurringPatternEmployees } from "../db/schema.js";
import { SERVICE_TYPES, JOB_STATUSES, DAYS_OF_WEEK, CLIENT_RESPONSE_STATUSES } from "../constants.js";
import { computeConflicts } from "../conflicts.js";

// Job statuses that count as "completed real work" for billing purposes — a fully completed
// job, or one cancelled partway through/after completion where actual hours were recorded.
const BILLABLE_STATUSES = ["completed", "cancelled-partial"] as const;

const jobInput = z.object({
  clientId: z.number(),
  // Multiple employees can be assigned to one job (e.g. a house cleaned by two people at once) —
  // one client, one visit, one time slot, but N cleaners. Billing stays per-job regardless of
  // how many employees are assigned; see clients.billingRate/billingRateType.
  employeeIds: z.array(z.number().int()).optional().default([]),
  serviceType: z.enum(SERVICE_TYPES),
  scheduledDate: z.string(), // YYYY-MM-DD
  startTime: z.string(), // HH:mm
  plannedDurationHours: z.number().positive(),
  status: z.enum(JOB_STATUSES).optional().default("scheduled"),
  recurringPatternId: z.number().int().optional().nullable(),
});

function withJoins() {
  return db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id));
}

/** Attaches assigned-employee ids/names to a batch of flattened (client-joined) job rows in one
 *  extra query, rather than N+1 per-job lookups. */
async function attachEmployees<T extends { id: number }>(rows: T[]): Promise<(T & { employeeIds: number[]; employeeNames: string[] })[]> {
  if (rows.length === 0) return [];
  const jobIds = rows.map((r) => r.id);
  const assignments = await db
    .select({ jobId: jobEmployees.jobId, employee: employees })
    .from(jobEmployees)
    .leftJoin(employees, eq(jobEmployees.employeeId, employees.id))
    .where(inArray(jobEmployees.jobId, jobIds));

  const byJob = new Map<number, { id: number; name: string }[]>();
  for (const a of assignments) {
    if (!a.employee) continue; // employee row missing (deleted without cleanup) — skip defensively
    byJob.set(a.jobId, [...(byJob.get(a.jobId) ?? []), { id: a.employee.id, name: a.employee.name }]);
  }

  return rows.map((row) => {
    const assigned = (byJob.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    return { ...row, employeeIds: assigned.map((e) => e.id), employeeNames: assigned.map((e) => e.name) };
  });
}

function flattenOne(row: { job: typeof jobs.$inferSelect; client: typeof clients.$inferSelect | null }) {
  return {
    ...row.job,
    clientName: row.client?.name ?? "Unknown client",
    clientPhone: row.client?.phone ?? "",
    clientAddress: row.client?.address ?? "",
    clientAccessNotes: row.client?.accessNotes ?? "",
    clientStatus: row.client?.status ?? "inactive",
    billingRate: row.client?.billingRate ?? 0,
    billingRateType: row.client?.billingRateType ?? "per-visit",
  };
}

async function flattenRows(rows: { job: typeof jobs.$inferSelect; client: typeof clients.$inferSelect | null }[]) {
  return attachEmployees(rows.map(flattenOne));
}

/** Replaces a job's assigned-employee set with `employeeIds` (delete then re-insert — no
 *  established transaction helper in this codebase, see generateWeek/employees.remove for the
 *  same sequential-await style over multi-step mutations). */
async function setJobEmployees(jobId: number, employeeIds: number[]) {
  await db.delete(jobEmployees).where(eq(jobEmployees.jobId, jobId));
  const unique = [...new Set(employeeIds)];
  if (unique.length > 0) {
    await db.insert(jobEmployees).values(unique.map((employeeId) => ({ jobId, employeeId })));
  }
}

export const jobsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        status: z.enum(JOB_STATUSES).optional(),
        clientId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.from) conditions.push(gte(jobs.scheduledDate, input.from));
      if (input.to) conditions.push(lte(jobs.scheduledDate, input.to));
      if (input.status) conditions.push(eq(jobs.status, input.status));
      if (input.clientId) conditions.push(eq(jobs.clientId, input.clientId));
      const query = withJoins();
      const rows = conditions.length ? await query.where(and(...conditions)) : await query;
      const flattened = await flattenRows(rows);
      return flattened.sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime));
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const rows = await withJoins().where(eq(jobs.id, input.id));
    const row = rows[0];
    if (!row) return null;
    const [flattened] = await flattenRows([row]);
    return flattened;
  }),

  create: protectedProcedure.input(jobInput).mutation(async ({ input }) => {
    const { employeeIds, ...rest } = input;
    const [row] = await db
      .insert(jobs)
      .values({ ...rest, updatedAt: new Date().toISOString() })
      .returning();
    if (employeeIds.length > 0) {
      await db.insert(jobEmployees).values(employeeIds.map((employeeId) => ({ jobId: row.id, employeeId })));
    }
    return row;
  }),

  update: protectedProcedure
    .input(jobInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, employeeIds, ...rest } = input;
      const [row] = await db
        .update(jobs)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(jobs.id, id))
        .returning();
      if (employeeIds !== undefined) {
        await setJobEmployees(id, employeeIds);
      }
      return row;
    }),

  // Cancel a job. Two real-world cases, one endpoint:
  //  - No hours worked (client cancelled before the visit, or the owner is reversing a
  //    mistaken "completed"): omit `actualHours` (or pass 0) → status "cancelled", no hours,
  //    never billed, never shows in the invoice export.
  //  - Real work happened before/around the cancellation (partial visit, or a "completed" job
  //    the client later disputed/cancelled but the crew still needs paying for the time spent):
  //    pass `actualHours` > 0 → status "cancelled-partial", which keeps those hours and still
  //    counts toward billing in the monthly export, same as a normal completed job.
  cancel: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        actualHours: z.number().min(0).optional(),
        completionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const billable = !!input.actualHours && input.actualHours > 0;
      const [row] = await db
        .update(jobs)
        .set({
          status: billable ? "cancelled-partial" : "cancelled",
          actualHours: billable ? input.actualHours : null,
          completionNotes: input.completionNotes ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, input.id))
        .returning();
      return row;
    }),

  // Permanently removes a job row from the roster — distinct from cancel, which keeps a
  // ("cancelled"/"cancelled-partial") record. For a job that was scheduled by mistake and
  // should just disappear (a generation error, a duplicate one-off, etc.), not a real
  // cancellation worth keeping a trace of. Blocked once a job carries billable history
  // (completed / cancelled-partial) — deleting those would silently remove real invoicing
  // data with no record; use Cancel instead to reverse a mistaken "completed" while keeping
  // a trace. If this job came from an active recurring pattern, the next "Generate this week"
  // will simply recreate it, same as if it had never been generated. job_employees rows for
  // this job cascade-delete automatically (see schema.ts).
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const [row] = await db.select().from(jobs).where(eq(jobs.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
    if ((BILLABLE_STATUSES as readonly string[]).includes(row.status)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This job has billable history and can't be deleted — use Cancel instead to keep a record.",
      });
    }
    await db.delete(jobs).where(eq(jobs.id, input.id));
    return { success: true };
  }),

  // Move a job to a new date/time (and optionally reassign the employee(s)) IN PLACE — same row,
  // same id, so nothing is orphaned or duplicated. Resets status to "scheduled" since it needs
  // reconfirming at the new slot. Not allowed once a job is cancelled/completed — reverse or
  // re-add instead.
  reschedule: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        scheduledDate: z.string(),
        startTime: z.string(),
        employeeIds: z.array(z.number().int()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existingRows = await db.select().from(jobs).where(eq(jobs.id, input.id));
      const existing = existingRows[0];
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      if (["cancelled", "cancelled-partial", "completed"].includes(existing.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reschedule a ${existing.status} job.`,
        });
      }
      const [row] = await db
        .update(jobs)
        .set({
          scheduledDate: input.scheduledDate,
          startTime: input.startTime,
          status: "scheduled",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, input.id))
        .returning();
      if (input.employeeIds !== undefined) {
        await setJobEmployees(input.id, input.employeeIds);
      }
      return row;
    }),

  complete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        actualHours: z.number().min(0),
        completionNotes: z.string().optional().default(""),
      })
    )
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(jobs)
        .set({
          status: "completed",
          actualHours: input.actualHours,
          completionNotes: input.completionNotes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, input.id))
        .returning();
      return row;
    }),

  // Toggles whether the CLIENT has flagged an issue with this job's slot — set by the owner from
  // the roster after hearing back from a client (phone/text, outside the app) in response to a
  // "heads-up" message. Entirely independent of the job's lifecycle `status`: doesn't block or
  // require anything else in the app, it's just a visual flag on the roster (same treatment as a
  // scheduling conflict, but distinguishable — see Roster.tsx).
  setClientResponseStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        clientResponseStatus: z.enum(CLIENT_RESPONSE_STATUSES),
      })
    )
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(jobs)
        .set({
          clientResponseStatus: input.clientResponseStatus,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, input.id))
        .returning();
      return row;
    }),

  // Generates Job rows for the 7-day window starting at `weekStart` (YYYY-MM-DD, expected Monday)
  // from all active recurring patterns. Skips a pattern/date if a job already exists for that
  // client on that date, so re-running is safe (no duplicates).
  generateWeek: protectedProcedure
    .input(z.object({ weekStart: z.string() }))
    .mutation(async ({ input }) => {
      const patterns = await db.select().from(recurringPatterns).where(eq(recurringPatterns.active, true));
      const weekStartDate = parseISO(input.weekStart);
      const created: (typeof jobs.$inferSelect)[] = [];
      const skipped: { clientId: number; date: string; reason: string }[] = [];

      for (const pattern of patterns) {
        const dayIndex = DAYS_OF_WEEK.indexOf(pattern.dayOfWeek as (typeof DAYS_OF_WEEK)[number]);
        if (dayIndex === -1) continue;
        const occurrenceDate = addDays(weekStartDate, dayIndex);
        const dateStr = format(occurrenceDate, "yyyy-MM-dd");

        if (pattern.frequency === "fortnightly") {
          // Alternate weeks based on ISO week number parity — simple, deterministic, no extra state.
          const weekNum = getISOWeek(occurrenceDate);
          if (weekNum % 2 !== 0) continue;
        }
        if (pattern.frequency === "every-3-weeks") {
          // Unlike fortnightly's global ISO-week parity, a 3-week cycle needs a fixed reference
          // point — otherwise "every 3 weeks" is ambiguous (which week is week 1?). Anchor to
          // anchorDate if set, else this pattern's own createdAt date.
          const anchor = parseISO((pattern.anchorDate ?? pattern.createdAt.slice(0, 10)) as string);
          const weeksSinceAnchor = differenceInCalendarWeeks(occurrenceDate, anchor, { weekStartsOn: 1 });
          if (((weeksSinceAnchor % 3) + 3) % 3 !== 0) continue;
        }
        if (pattern.frequency === "monthly") {
          // Only generate on the first occurrence of this weekday in the month.
          if (getDate(occurrenceDate) > 7) continue;
        }
        if (pattern.frequency === "one-off") continue;

        // Dedupe against two things:
        //  1. Any job (pattern-generated or one-off) already sitting on this client+date — the
        //     plain "don't double-book the same client/date" case, including a job that was
        //     rescheduled INTO this date and now happens to land on the same slot the pattern
        //     would generate.
        //  2. A job from THIS pattern whose original (as-generated) date was this date, even if
        //     it has since been rescheduled to a different date — without this, regenerating a
        //     week that a job was rescheduled OUT of would recreate a duplicate at the old slot.
        const existing = await db
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.clientId, pattern.clientId),
              or(eq(jobs.scheduledDate, dateStr), and(eq(jobs.recurringPatternId, pattern.id), eq(jobs.originalDate, dateStr)))
            )
          );
        if (existing.length > 0) {
          skipped.push({ clientId: pattern.clientId, date: dateStr, reason: "Job already exists" });
          continue;
        }

        const [row] = await db
          .insert(jobs)
          .values({
            clientId: pattern.clientId,
            serviceType: pattern.serviceType,
            scheduledDate: dateStr,
            originalDate: dateStr,
            startTime: pattern.startTime,
            plannedDurationHours: pattern.durationHours,
            status: "scheduled",
            recurringPatternId: pattern.id,
            updatedAt: new Date().toISOString(),
          })
          .returning();

        // Carry the pattern's assigned employee(s) over onto the generated job.
        const patternAssignments = await db
          .select()
          .from(recurringPatternEmployees)
          .where(eq(recurringPatternEmployees.patternId, pattern.id));
        if (patternAssignments.length > 0) {
          await db
            .insert(jobEmployees)
            .values(patternAssignments.map((a) => ({ jobId: row.id, employeeId: a.employeeId })));
        }

        created.push(row);
      }

      return { created: created.length, skipped };
    }),

  // Flags scheduling conflicts within a date range: double-booked employees, employees on
  // time-off, and employees not qualified for the job's service type.
  conflicts: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      return computeConflicts(input.from, input.to);
    }),

  // Every job scheduled for a given date (defaults to tomorrow) with status confirmed/scheduled —
  // used to build client reminder messages.
  upcomingReminders: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(async ({ input }) => {
      const date = input.date ?? format(addDays(new Date(), 1), "yyyy-MM-dd");
      const rawRows = await withJoins().where(eq(jobs.scheduledDate, date));
      const rows = (await flattenRows(rawRows)).filter((j) => j.status === "scheduled" || j.status === "confirmed");
      return rows;
    }),

  // Completed (and partially-completed-then-cancelled) jobs within a given date range
  // (inclusive, YYYY-MM-DD), including paused/inactive clients' history. Jobs cancelled
  // with no hours worked are excluded — nothing was done, nothing is owed.
  monthlyExport: protectedProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const { from, to } = input;
    const rawRows = await withJoins().where(
      and(
        gte(jobs.scheduledDate, from),
        lte(jobs.scheduledDate, to),
        or(...BILLABLE_STATUSES.map((s) => eq(jobs.status, s)))
      )
    );
    const rows = await flattenRows(rawRows);

    return rows
      .map((j) => {
        const hours = j.actualHours ?? j.plannedDurationHours;
        const total = j.billingRateType === "per-hour" ? j.billingRate * hours : j.billingRate;
        return { ...j, computedTotal: Math.round(total * 100) / 100 };
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.scheduledDate.localeCompare(b.scheduledDate));
  }),
});
