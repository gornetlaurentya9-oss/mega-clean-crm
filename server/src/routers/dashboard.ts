import { and, eq, gte, lte, lt, or, inArray } from "drizzle-orm";
import { format, startOfWeek, endOfWeek, startOfMonth, addDays } from "date-fns";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { jobs, clients, employees, jobEmployees } from "../db/schema.js";
import { computeConflicts } from "../conflicts.js";

// Same billable-status rule as the invoice export — a plain "cancelled" job (no hours worked)
// must never count toward revenue.
const BILLABLE_STATUSES = ["completed", "cancelled-partial"] as const;

const ACTIVE_JOB_LIMIT = 8;

export const dashboardRouter = router({
  summary: protectedProcedure.query(async () => {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    const weekJobsRaw = await db
      .select()
      .from(jobs)
      .where(and(gte(jobs.scheduledDate, weekStart), lte(jobs.scheduledDate, weekEnd)));
    const weekJobs = weekJobsRaw.filter((j) => j.status !== "cancelled");

    const monthCompletedJobs = await db
      .select({ job: jobs, client: clients })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .where(and(gte(jobs.scheduledDate, monthStart), or(...BILLABLE_STATUSES.map((s) => eq(jobs.status, s)))));

    const revenueToDate = monthCompletedJobs.reduce((sum, { job, client }) => {
      if (!client) return sum;
      const hours = job.actualHours ?? job.plannedDurationHours;
      const total = client.billingRateType === "per-hour" ? client.billingRate * hours : client.billingRate;
      return sum + total;
    }, 0);

    const awaitingCompletionRaw = await db
      .select()
      .from(jobs)
      .where(lt(jobs.scheduledDate, today));
    const awaitingCompletion = awaitingCompletionRaw.filter(
      (j) => j.status === "scheduled" || j.status === "confirmed"
    ).length;

    const conflictCount = (await computeConflicts(weekStart, weekEnd)).length;

    return {
      weekJobCount: weekJobs.length,
      monthRevenueToDate: Math.round(revenueToDate * 100) / 100,
      jobsAwaitingCompletion: awaitingCompletion,
      conflictCount,
    };
  }),

  // Extra at-a-glance detail for the dashboard: today/tomorrow's remaining jobs, active
  // conflicts (enriched with enough job info to link straight to the roster), and jobs still
  // awaiting completion confirmation. Kept short/mobile-friendly — this is not an analytics page.
  details: protectedProcedure.query(async () => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const twoWeeksOut = format(addDays(now, 13), "yyyy-MM-dd");

    function withJoins() {
      return db
        .select({ job: jobs, client: clients })
        .from(jobs)
        .leftJoin(clients, eq(jobs.clientId, clients.id));
    }

    // Attaches assigned-employee names to a batch of job rows in one extra query (same pattern
    // as jobs.ts's attachEmployees) rather than N+1 per-job lookups.
    async function employeeNamesByJob(jobIds: number[]): Promise<Map<number, string[]>> {
      if (jobIds.length === 0) return new Map();
      const assignments = await db
        .select({ jobId: jobEmployees.jobId, employee: employees })
        .from(jobEmployees)
        .leftJoin(employees, eq(jobEmployees.employeeId, employees.id))
        .where(inArray(jobEmployees.jobId, jobIds));
      const map = new Map<number, string[]>();
      for (const a of assignments) {
        if (!a.employee) continue;
        map.set(a.jobId, [...(map.get(a.jobId) ?? []), a.employee.name].sort());
      }
      return map;
    }

    const upcomingRaw = await withJoins().where(
      and(gte(jobs.scheduledDate, today), lte(jobs.scheduledDate, tomorrow))
    );
    const upcomingFiltered = upcomingRaw.filter((r) => r.job.status === "scheduled" || r.job.status === "confirmed");
    const upcomingNames = await employeeNamesByJob(upcomingFiltered.map((r) => r.job.id));
    const upcoming = upcomingFiltered
      .map((r) => ({
        id: r.job.id,
        scheduledDate: r.job.scheduledDate,
        startTime: r.job.startTime,
        clientName: r.client?.name ?? "Unknown client",
        employeeNames: upcomingNames.get(r.job.id) ?? [],
        status: r.job.status,
      }))
      .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
      .slice(0, ACTIVE_JOB_LIMIT);

    // Look a little further out than "this week" so a conflict created by editing next week's
    // roster (or next week's time-off) still surfaces here, not just this week's count.
    const conflicts = await computeConflicts(weekStart, twoWeeksOut);
    const conflictJobIds = [...new Set(conflicts.map((c) => c.jobId))];
    const conflictJobRows = conflictJobIds.length
      ? await withJoins().where(inArray(jobs.id, conflictJobIds))
      : [];
    const conflictJobMap = new Map(conflictJobRows.map((r) => [r.job.id, r]));
    const conflictDetails = conflicts
      .map((c) => {
        const r = conflictJobMap.get(c.jobId);
        return {
          ...c,
          scheduledDate: r?.job.scheduledDate ?? null,
          startTime: r?.job.startTime ?? null,
          clientName: r?.client?.name ?? "Unknown client",
        };
      })
      .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
      .slice(0, ACTIVE_JOB_LIMIT);

    const awaitingRaw = await withJoins().where(lt(jobs.scheduledDate, today));
    const awaitingFiltered = awaitingRaw.filter((r) => r.job.status === "scheduled" || r.job.status === "confirmed");
    const awaitingNames = await employeeNamesByJob(awaitingFiltered.map((r) => r.job.id));
    const awaiting = awaitingFiltered
      .map((r) => ({
        id: r.job.id,
        scheduledDate: r.job.scheduledDate,
        startTime: r.job.startTime,
        serviceType: r.job.serviceType,
        clientName: r.client?.name ?? "Unknown client",
        employeeNames: awaitingNames.get(r.job.id) ?? [],
        plannedDurationHours: r.job.plannedDurationHours,
      }))
      .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
      .slice(0, ACTIVE_JOB_LIMIT);

    return { upcoming, conflictDetails, awaiting };
  }),
});
