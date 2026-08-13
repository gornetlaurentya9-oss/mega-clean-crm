import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { addDays, format, parseISO, getISOWeek, getDate } from "date-fns";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { jobs, clients, employees, recurringPatterns } from "../db/schema.js";
import { SERVICE_TYPES, JOB_STATUSES, DAYS_OF_WEEK } from "../constants.js";
import { computeConflicts } from "../conflicts.js";

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
    .query(({ input }) => {
      const conditions = [];
      if (input.from) conditions.push(gte(jobs.scheduledDate, input.from));
      if (input.to) conditions.push(lte(jobs.scheduledDate, input.to));
      if (input.status) conditions.push(eq(jobs.status, input.status));
      if (input.clientId) conditions.push(eq(jobs.clientId, input.clientId));
      const query = withJoins();
      const rows = conditions.length ? query.where(and(...conditions)).all() : query.all();
      return rows.map(flatten).sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime));
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => {
    const row = withJoins().where(eq(jobs.id, input.id)).get();
    return row ? flatten(row) : null;
  }),

  create: protectedProcedure.input(jobInput).mutation(({ input }) => {
    const row = db
      .insert(jobs)
      .values({ ...input, updatedAt: new Date().toISOString() })
      .returning()
      .get();
    return row;
  }),

  update: protectedProcedure
    .input(jobInput.partial().extend({ id: z.number() }))
    .mutation(({ input }) => {
      const { id, ...rest } = input;
      return db
        .update(jobs)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(jobs.id, id))
        .returning()
        .get();
    }),

  cancel: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => {
    return db
      .update(jobs)
      .set({ status: "cancelled", updatedAt: new Date().toISOString() })
      .where(eq(jobs.id, input.id))
      .returning()
      .get();
  }),

  complete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        actualHours: z.number().min(0),
        completionNotes: z.string().optional().default(""),
      })
    )
    .mutation(({ input }) => {
      return db
        .update(jobs)
        .set({
          status: "completed",
          actualHours: input.actualHours,
          completionNotes: input.completionNotes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, input.id))
        .returning()
        .get();
    }),

  // Generates Job rows for the 7-day window starting at `weekStart` (YYYY-MM-DD, expected Monday)
  // from all active recurring patterns. Skips a pattern/date if a job already exists for that
  // client on that date, so re-running is safe (no duplicates).
  generateWeek: protectedProcedure
    .input(z.object({ weekStart: z.string() }))
    .mutation(({ input }) => {
      const patterns = db.select().from(recurringPatterns).where(eq(recurringPatterns.active, true)).all();
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

        const existing = db
          .select()
          .from(jobs)
          .where(and(eq(jobs.clientId, pattern.clientId), eq(jobs.scheduledDate, dateStr)))
          .all();
        if (existing.length > 0) {
          skipped.push({ clientId: pattern.clientId, date: dateStr, reason: "Job already exists" });
          continue;
        }

        const row = db
          .insert(jobs)
          .values({
            clientId: pattern.clientId,
            employeeId: pattern.defaultEmployeeId ?? null,
            serviceType: pattern.serviceType,
            scheduledDate: dateStr,
            startTime: pattern.startTime,
            plannedDurationHours: pattern.durationHours,
            status: "scheduled",
            recurringPatternId: pattern.id,
            updatedAt: new Date().toISOString(),
          })
          .returning()
          .get();
        created.push(row);
      }

      return { created: created.length, skipped };
    }),

  // Flags scheduling conflicts within a date range: double-booked employees, employees on
  // time-off, and employees not qualified for the job's service type.
  conflicts: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(({ input }) => {
      return computeConflicts(input.from, input.to);
    }),

  // Every job scheduled for a given date (defaults to tomorrow) with status confirmed/scheduled —
  // used to build client reminder messages.
  upcomingReminders: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(({ input }) => {
      const date = input.date ?? format(addDays(new Date(), 1), "yyyy-MM-dd");
      const rows = withJoins()
        .where(eq(jobs.scheduledDate, date))
        .all()
        .map(flatten)
        .filter((j) => j.status === "scheduled" || j.status === "confirmed");
      return rows;
    }),

  // Completed jobs for a given month (YYYY-MM), including paused/inactive clients' history.
  monthlyExport: protectedProcedure.input(z.object({ month: z.string() })).query(({ input }) => {
    const from = `${input.month}-01`;
    const to = `${input.month}-31`;
    const rows = withJoins()
      .where(and(gte(jobs.scheduledDate, from), lte(jobs.scheduledDate, to), eq(jobs.status, "completed")))
      .all()
      .map(flatten);

    return rows
      .map((j) => {
        const hours = j.actualHours ?? j.plannedDurationHours;
        const total = j.billingRateType === "per-hour" ? j.billingRate * hours : j.billingRate;
        return { ...j, computedTotal: Math.round(total * 100) / 100 };
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.scheduledDate.localeCompare(b.scheduledDate));
  }),
});
