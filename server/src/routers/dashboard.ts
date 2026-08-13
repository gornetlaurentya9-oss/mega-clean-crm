import { and, eq, gte, lte, lt } from "drizzle-orm";
import { format, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { jobs, clients } from "../db/schema.js";
import { computeConflicts } from "../conflicts.js";

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
      .where(and(gte(jobs.scheduledDate, monthStart), eq(jobs.status, "completed")))
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
});
