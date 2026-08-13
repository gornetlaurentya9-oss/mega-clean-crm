import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { addDays, format, parseISO, getISOWeek, getDate } from "date-fns";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { jobs, clients, employees, recurringPatterns } from "../db/schema.js";
import { SERVICE_TYPES, JOB_STATUSES, DAYS_OF_WEEK } from "../constants.js";
import { computeConflicts } from "../conflicts.js";

// Job statuses that count as "completed real work" for billing purposes — a fully completed
// job, or one cancelled partway through/after completion where actual hours were recorded.
const BILLABLE_STATUSES = ["completed", "cancelled-partial"] as const;

const jobInput = z.object({
  clientId: z.number(),
  employeeId: z.number().int().optional().nullable(),
  serviceType: z.enum(SERVICE_TYPES),
  scheduledDate: z.string(), // YYYY-MM-DD
  startTime: z.string(), // HH:mm
  plannedDurationHours: z.number().positive(),
  status: z.enum(JOB_STATUSES).optional().default("scheduled"),
  recurringPatternId: z.number().int().optional().nullable(),
});

function withJoins() {
  return db
    .select({
      job: jobs,
      client: clients,
      employee: employees,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(employees, eq(jobs.employeeId, employees.id));
}

function flatten(row: { job: typeof jobs.$inferSelect; client: typeof clients.$inferSelect | null; employee: typeof employees.$inferSelect | null }) {
  return {
    ...row.job,
    clientName: row.client?.name ?? "Unknown client",
    clientPhone: row.client?.phone ?? "",
    clientAddress: row.client?.address ?? "",
    clientAccessNotes: row.client?.accessNotes ?? "",
    clientStatus: row.client?.status ?? "inactive",
    billingRate: row.client?.billingRate ?? 0,
    billingRateType: row.client?.billingRateType ?? "per-visit",
    employeeName: row.employee?.name ?? null,
    employeePhone: row.employee?.phone ?? null,
  };
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
      return rows.map(flatten).sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime));
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const rows = await withJoins().where(eq(jobs.id, input.id));
    const row = rows[0];
    return row ? flatten(row) : null;
  }),

  create: protectedProcedure.input(jobInput).mutation(async ({ input }) => {
    const [row] = await db
      .insert(jobs)
      .values({ ...input, updatedAt: new Date().toISOString() })
      .returning();
    return row;
  }),

  update: protectedProcedure
    .input(jobInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const [row] = await db
        .update(jobs)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(jobs.id, id))
        .returning();
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

  // Move a job to a new date/time (and optionally reassign the employee) IN PLACE — same row,
  // same id, so nothing is orphaned or duplicated. Resets status to "scheduled" since it needs
  // reconfirming at the new slot. Not allowed once a job is cancelled/completed — reverse or
  // re-add instead.
  reschedule: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        scheduledDate: z.string(),
        startTime: z.string(),
        employeeId: z.number().int().optional().nullable(),
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
          employeeId: input.employeeId !== undefined ? input.employeeId : existing.employeeId,
          status: "scheduled",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, input.id))
        .returning();
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
            employeeId: pattern.defaultEmployeeId ?? null,
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
      const rows = rawRows.map(flatten).filter((j) => j.status === "scheduled" || j.status === "confirmed");
      return rows;
    }),

  // Completed (and partially-completed-then-cancelled) jobs for a given month (YYYY-MM),
  // including paused/inactive clients' history. Jobs cancelled with no hours worked are
  // excluded — nothing was done, nothing is owed.
  monthlyExport: protectedProcedure.input(z.object({ month: z.string() })).query(async ({ input }) => {
    const from = `${input.month}-01`;
    const to = `${input.month}-31`;
    const rawRows = await withJoins().where(
      and(
        gte(jobs.scheduledDate, from),
        lte(jobs.scheduledDate, to),
        or(...BILLABLE_STATUSES.map((s) => eq(jobs.status, s)))
      )
    );
    const rows = rawRows.map(flatten);

    return rows
      .map((j) => {
        const hours = j.actualHours ?? j.plannedDurationHours;
        const total = j.billingRateType === "per-hour" ? j.billingRate * hours : j.billingRate;
        return { ...j, computedTotal: Math.round(total * 100) / 100 };
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.scheduledDate.localeCompare(b.scheduledDate));
  }),
});
