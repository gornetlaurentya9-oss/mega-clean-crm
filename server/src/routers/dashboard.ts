import { and, eq, gte, lte, lt, or, inArray } from "drizzle-orm";
import { format, startOfWeek, endOfWeek, startOfMonth, addDays } from "date-fns";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { jobs, clients, employees } from "../db/schema.js";
import { computeConflicts } from "../conflicts.js";

// Same billable-status rule as the invoice export — a plain "cancelled" job (no hours worked)
// must never count toward revenue.
const BILLABLE_STATUSES = ["completed", "cancelled-partial"] as const;

const ACTIVE_JOB_LIMIT = 8;

export const dashboardRouter = router({
  summary: protectedProcedure.query(() => {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    const weekJobs = db
      .select()
      .from(jobs)
      .where(and(gte(jobs.scheduledDate, weekStart), lte(jobs.scheduledDate, weekEnd)))
      .all()
      .filter((j) => j.status !== "cancelled");

    const monthCompletedJobs = db
      .select({ job: jobs, client: clients })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .where(and(gte(jobs.scheduledDate, monthStart), or(...BILLABLE_STATUSES.map((s) => eq(jobs.status, s)))))
      .all();

    const revenueToDate = monthCompletedJobs.reduce((sum, { job, client }) => {
      if (!client) return sum;
      const hours = job.actualHours ?? job.plannedDurationHours;
      const total = client.billingRateType === "per-hour" ? client.billingRate * hours : client.billingRate;
      return sum + total;
    }, 0);

    const awaitingCompletion = db
      .select()
      .from(jobs)
      .where(lt(jobs.scheduledDate, today))
      .all()
      .filter((j) => j.status === "scheduled" || j.status === "confirmed").length;

    const conflictCount = computeConflicts(weekStart, weekEnd).length;

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
  details: protectedProcedure.query(() => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const twoWeeksOut = format(addDays(now, 13), "yyyy-MM-dd");

    function withJoins() {
      return db
        .select({ job: jobs, client: clients, employee: employees })
        .from(jobs)
        .leftJoin(clients, eq(jobs.clientId, clients.id))
        .leftJoin(employees, eq(jobs.employeeId, employees.id));
    }

    const upcoming = withJoins()
      .where(and(gte(jobs.scheduledDate, today), lte(jobs.scheduledDate, tomorrow)))
      .all()
      .filter((r) => r.job.status === "scheduled" || r.job.status === "confirmed")
      .map((r) => ({
        id: r.job.id,
        scheduledDate: r.job.scheduledDate,
        startTime: r.job.startTime,
        clientName: r.client?.name ?? "Unknown client",
        employeeName: r.employee?.name ?? null,
        status: r.job.status,
      }))
      .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
      .slice(0, ACTIVE_JOB_LIMIT);

    // Look a little further out than "this week" so a conflict created by editing next week's
    // roster (or next week's time-off) still surfaces here, not just this week's count.
    const conflicts = computeConflicts(weekStart, twoWeeksOut);
    const conflictJobIds = [...new Set(conflicts.map((c) => c.jobId))];
    const conflictJobRows = conflictJobIds.length
      ? withJoins().where(inArray(jobs.id, conflictJobIds)).all()
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

    const awaiting = withJoins()
      .where(lt(jobs.scheduledDate, today))
      .all()
      .filter((r) => r.job.status === "scheduled" || r.job.status === "confirmed")
      .map((r) => ({
        id: r.job.id,
        scheduledDate: r.job.scheduledDate,
        startTime: r.job.startTime,
        serviceType: r.job.serviceType,
        clientName: r.client?.name ?? "Unknown client",
        employeeName: r.employee?.name ?? null,
        plannedDurationHours: r.job.plannedDurationHours,
      }))
      .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
      .slice(0, ACTIVE_JOB_LIMIT);

    return { upcoming, conflictDetails, awaiting };
  }),
});
