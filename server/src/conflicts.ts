import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { getISODay, parseISO } from "date-fns";
import { db } from "./db/index.js";
import { jobs, clients, employees, employeeTimeOff, jobEmployees } from "./db/schema.js";
import { DAYS_OF_WEEK, DAY_LABELS } from "./constants.js";

function weekdayOf(dateStr: string): (typeof DAYS_OF_WEEK)[number] {
  // getISODay: 1=Monday..7=Sunday, matching DAYS_OF_WEEK's index+1 order.
  return DAYS_OF_WEEK[getISODay(parseISO(dateStr)) - 1];
}

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
  type: "double-booked" | "time-off" | "not-qualified" | "day-off";
  message: string;
}

/**
 * Flags scheduling conflicts within a date range (inclusive, YYYY-MM-DD).
 *
 * A job can now carry more than one assigned employee (e.g. a house cleaned by two people at
 * once), so every check below runs PER ASSIGNED EMPLOYEE on a job, not once per job — a job with
 * two employees is double-booked if EITHER has an overlapping job elsewhere, on time-off if
 * EITHER is off that day, and unqualified if EITHER lacks the service type. Each affected
 * employee gets their own conflict message (rather than one vague combined message) so the
 * roster's conflict list stays specific about who the problem is.
 */
export async function computeConflicts(from: string, to: string): Promise<JobConflict[]> {
  const jobRows = await db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(gte(jobs.scheduledDate, from), lte(jobs.scheduledDate, to)));

  // Only non-cancelled, still-active jobs can conflict. "cancelled" (no work done) and
  // "cancelled-partial" (work already wrapped up and billed) are resolved/historical — they
  // must never keep flagging a conflict, and cancelling one job in a double-booking must clear
  // the flag on the other.
  const rows = jobRows.filter((r) => r.job.status !== "cancelled" && r.job.status !== "cancelled-partial");
  if (rows.length === 0) return [];

  const jobIds = rows.map((r) => r.job.id);
  const assignmentRows = await db
    .select({ jobId: jobEmployees.jobId, employee: employees })
    .from(jobEmployees)
    .leftJoin(employees, eq(jobEmployees.employeeId, employees.id))
    .where(inArray(jobEmployees.jobId, jobIds));

  const employeesByJob = new Map<
    number,
    { id: number; name: string; qualifiedServiceTypes: string; availability: string }[]
  >();
  for (const a of assignmentRows) {
    if (!a.employee) continue;
    employeesByJob.set(a.jobId, [
      ...(employeesByJob.get(a.jobId) ?? []),
      {
        id: a.employee.id,
        name: a.employee.name,
        qualifiedServiceTypes: a.employee.qualifiedServiceTypes,
        availability: a.employee.availability,
      },
    ]);
  }

  const timeOffRows = await db.select().from(employeeTimeOff);
  const conflicts: JobConflict[] = [];

  for (const row of rows) {
    const job = row.job;
    const clientName = row.client?.name ?? "Unknown client";
    const assigned = employeesByJob.get(job.id) ?? [];

    for (const emp of assigned) {
      // Double-booked: this employee has another (different) active job on the same date whose
      // time overlaps this one.
      for (const other of rows) {
        if (other.job.id === job.id) continue;
        if (other.job.scheduledDate !== job.scheduledDate) continue;
        const otherAssigned = employeesByJob.get(other.job.id) ?? [];
        if (!otherAssigned.some((e) => e.id === emp.id)) continue;
        if (overlaps(job.startTime, job.plannedDurationHours, other.job.startTime, other.job.plannedDurationHours)) {
          conflicts.push({
            jobId: job.id,
            type: "double-booked",
            message: `${emp.name} is double-booked on ${job.scheduledDate} (overlaps with ${
              other.client?.name ?? "another client"
            } at ${other.job.startTime}).`,
          });
          break;
        }
      }

      const onLeave = timeOffRows.some(
        (t) => t.employeeId === emp.id && job.scheduledDate >= t.startDate && job.scheduledDate <= t.endDate
      );
      if (onLeave) {
        conflicts.push({
          jobId: job.id,
          type: "time-off",
          message: `${emp.name} is on time off on ${job.scheduledDate}.`,
        });
      }

      const qualified = JSON.parse(emp.qualifiedServiceTypes || "[]") as string[];
      if (qualified.length > 0 && !qualified.includes(job.serviceType)) {
        conflicts.push({
          jobId: job.id,
          type: "not-qualified",
          message: `${emp.name} is not qualified for ${job.serviceType} (job for ${clientName}).`,
        });
      }

      // Fixed weekly day off (permanent recurring unavailability — see the `availability` column
      // comment in schema.ts), distinct from the one-off `employeeTimeOff` date-range check above.
      // Recomputed live on every load exactly like the other checks: a day-off rule added after a
      // job was already generated/assigned retroactively flags that existing job here, with no
      // regeneration needed.
      const daysOff = JSON.parse(emp.availability || "[]") as (typeof DAYS_OF_WEEK)[number][];
      const weekday = weekdayOf(job.scheduledDate);
      if (daysOff.includes(weekday)) {
        conflicts.push({
          jobId: job.id,
          type: "day-off",
          message: `${emp.name} doesn't normally work ${DAY_LABELS[weekday]}s — scheduled on ${job.scheduledDate} for ${clientName}.`,
        });
      }
    }
  }

  return conflicts;
}
