import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "./db/index.js";
import { jobs, clients, employees, employeeTimeOff } from "./db/schema.js";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function overlaps(aStart: string, aDur: number, bStart: string, bDur: number): boolean {
  const aS = timeToMinutes(aStart);
  const aE = aS + aDur * 60;
  const bS = timeToMinutes(bStart);
  const bE = bS + bDur * 60;
  return aS < bE && bS < aE;
}

export interface JobConflict {
  jobId: number;
  type: "double-booked" | "time-off" | "not-qualified";
  message: string;
}

/** Flags scheduling conflicts within a date range (inclusive, YYYY-MM-DD). */
export async function computeConflicts(from: string, to: string): Promise<JobConflict[]> {
  const allRows = await db
    .select({ job: jobs, client: clients, employee: employees })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(employees, eq(jobs.employeeId, employees.id))
    .where(and(gte(jobs.scheduledDate, from), lte(jobs.scheduledDate, to)));
  // Only non-cancelled, still-active jobs can conflict. "cancelled" (no work done) and
  // "cancelled-partial" (work already wrapped up and billed) are resolved/historical — they
  // must never keep flagging a conflict, and cancelling one job in a double-booking must clear
  // the flag on the other.
  const rows = allRows.filter(
    (r) => r.job.status !== "cancelled" && r.job.status !== "cancelled-partial" && r.job.employeeId != null
  );

  const timeOffRows = await db.select().from(employeeTimeOff);
  const conflicts: JobConflict[] = [];

  for (const row of rows) {
    const job = row.job;
    const employeeName = row.employee?.name ?? "Unknown";
    const clientName = row.client?.name ?? "Unknown client";

    for (const other of rows) {
      if (other.job.id === job.id) continue;
      if (other.job.employeeId !== job.employeeId) continue;
      if (other.job.scheduledDate !== job.scheduledDate) continue;
      if (
        overlaps(job.startTime, job.plannedDurationHours, other.job.startTime, other.job.plannedDurationHours)
      ) {
        conflicts.push({
          jobId: job.id,
          type: "double-booked",
          message: `${employeeName} is double-booked on ${job.scheduledDate} (overlaps with ${
            other.client?.name ?? "another client"
          } at ${other.job.startTime}).`,
        });
        break;
      }
    }

    const onLeave = timeOffRows.some(
      (t) => t.employeeId === job.employeeId && job.scheduledDate >= t.startDate && job.scheduledDate <= t.endDate
    );
    if (onLeave) {
      conflicts.push({
        jobId: job.id,
        type: "time-off",
        message: `${employeeName} is on time off on ${job.scheduledDate}.`,
      });
    }

    if (row.employee) {
      const qualified = JSON.parse(row.employee.qualifiedServiceTypes || "[]") as string[];
      if (qualified.length > 0 && !qualified.includes(job.serviceType)) {
        conflicts.push({
          jobId: job.id,
          type: "not-qualified",
          message: `${employeeName} is not qualified for ${job.serviceType} (job for ${clientName}).`,
        });
      }
    }
  }

  return conflicts;
}
