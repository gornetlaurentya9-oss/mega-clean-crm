import { useMemo, useState } from "react";
import { Link } from "wouter";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { trpc } from "../lib/trpc";
import { DAY_LABELS } from "../lib/constants";
import { Badge, Button, Card, EmptyState, Spinner, cx } from "../components/ui";
import { JobModal } from "../components/JobModal";
import { CompleteJobModal } from "../components/CompleteJobModal";
import { CancelJobModal } from "../components/CancelJobModal";
import { RescheduleModal } from "../components/RescheduleModal";

const statusTone: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  scheduled: "blue",
  confirmed: "green",
  completed: "gray",
  cancelled: "red",
  "cancelled-partial": "yellow",
  rescheduled: "yellow",
};

const statusLabel: Record<string, string> = {
  "cancelled-partial": "cancelled (partial billed)",
};

export default function Roster() {
  const [weekStart, setWeekStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [view, setView] = useState<"day" | "employee">("day");
  const [editJob, setEditJob] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [completeJob, setCompleteJob] = useState<any>(null);
  const [cancelJob, setCancelJob] = useState<any>(null);
  const [rescheduleJob, setRescheduleJob] = useState<any>(null);

  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const utils = trpc.useUtils();
  const jobs = trpc.jobs.list.useQuery({ from: weekStart, to: weekEnd });
  const conflicts = trpc.jobs.conflicts.useQuery({ from: weekStart, to: weekEnd });
  const employees = trpc.employees.list.useQuery({ status: "active" });

  const generate = trpc.jobs.generateWeek.useMutation({
    onSuccess: (res) => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      alert(`Generated ${res.created} job(s). Skipped ${res.skipped.length} (already existed).`);
    },
  });

  const conflictsByJob = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const c of conflicts.data ?? []) {
      map.set(c.jobId, [...(map.get(c.jobId) ?? []), c.message]);
    }
    return map;
  }, [conflicts.data]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"));
  }, [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of days) map.set(d, []);
    for (const j of jobs.data ?? []) {
      if (map.has(j.scheduledDate)) map.get(j.scheduledDate)!.push(j);
    }
    return map;
  }, [jobs.data, days]);

  const byEmployee = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const j of jobs.data ?? []) {
      const key = j.employeeName ?? "Unassigned";
      map.set(key, [...(map.get(key) ?? []), j]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [jobs.data]);

  function JobRow({ job }: { job: any }) {
    const jobConflicts = conflictsByJob.get(job.id) ?? [];
    const cancelled = job.status === "cancelled" || job.status === "cancelled-partial";
    return (
      <div
        className={cx(
          "rounded-lg border p-2.5",
          jobConflicts.length ? "border-red-300 bg-red-50" : cancelled ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className={cx("min-w-0", cancelled && "opacity-60")}>
            <div className={cx("font-medium text-gray-900", cancelled && "line-through")}>
              {job.startTime} · {job.clientName}
            </div>
            <div className="text-xs text-gray-500">
              {job.serviceType} · {job.employeeName ?? "Unassigned"} · {job.plannedDurationHours}h
              {job.status === "cancelled-partial" && job.actualHours != null && (
                <> · billed {job.actualHours}h</>
              )}
            </div>
            {jobConflicts.map((m, i) => (
              <div key={i} className="mt-1 text-xs font-medium text-red-700">
                ⚠ {m}
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge tone={statusTone[job.status] ?? "gray"}>{statusLabel[job.status] ?? job.status}</Badge>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditJob(job)}>
            Edit
          </Button>
          {job.status !== "completed" && !cancelled && (
            <Button size="sm" onClick={() => setCompleteJob(job)}>
              Mark complete
            </Button>
          )}
          {job.status !== "completed" && !cancelled && (
            <Button size="sm" variant="secondary" onClick={() => setRescheduleJob(job)}>
              Reschedule
            </Button>
          )}
          {!cancelled && (
            <Button size="sm" variant="danger" onClick={() => setCancelJob(job)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Weekly roster</h1>
        <Button onClick={() => setAddOpen(true)}>+ One-off job</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd"))}>
          ← Prev
        </Button>
        <span className="font-medium text-gray-700">
          {format(parseISO(weekStart), "d MMM")} – {format(parseISO(weekEnd), "d MMM yyyy")}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd"))}>
          Next →
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate.mutate({ weekStart })} disabled={generate.isPending}>
          {generate.isPending ? "Generating…" : "Generate this week from patterns"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={view === "day" ? "primary" : "secondary"} onClick={() => setView("day")}>
          By day
        </Button>
        <Button size="sm" variant={view === "employee" ? "primary" : "secondary"} onClick={() => setView("employee")}>
          By employee
        </Button>
      </div>

      {jobs.isLoading ? (
        <Spinner />
      ) : view === "day" ? (
        <div className="space-y-4">
          {days.map((d) => {
            const dayJobs = (byDay.get(d) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const weekday = format(parseISO(d), "EEEE");
            return (
              <div key={d}>
                <h2 className="mb-1 font-semibold text-gray-800">
                  {weekday} <span className="font-normal text-gray-400">{format(parseISO(d), "d MMM")}</span>
                </h2>
                {dayJobs.length === 0 ? (
                  <p className="text-sm text-gray-400">No jobs.</p>
                ) : (
                  <div className="space-y-2">
                    {dayJobs.map((j) => (
                      <JobRow key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {byEmployee.length === 0 ? (
            <EmptyState>No jobs scheduled this week.</EmptyState>
          ) : (
            byEmployee.map(([name, empJobs]) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">{name}</h2>
                  {name !== "Unassigned" && (
                    <PrintLink weekStart={weekStart} employeeName={name} employees={employees.data} />
                  )}
                </div>
                <div className="space-y-2">
                  {empJobs
                    .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
                    .map((j) => (
                      <JobRow key={j.id} job={j} />
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <JobModal open={addOpen} onClose={() => setAddOpen(false)} defaultDate={weekStart} />
      <JobModal open={!!editJob} onClose={() => setEditJob(null)} job={editJob} />
      <CompleteJobModal open={!!completeJob} onClose={() => setCompleteJob(null)} job={completeJob} />
      <CancelJobModal open={!!cancelJob} onClose={() => setCancelJob(null)} job={cancelJob} />
      <RescheduleModal open={!!rescheduleJob} onClose={() => setRescheduleJob(null)} job={rescheduleJob} />
    </div>
  );
}

function PrintLink({ weekStart, employeeName, employees }: { weekStart: string; employeeName: string; employees?: any[] }) {
  const emp = employees?.find((e) => e.name === employeeName);
  if (!emp) return null;
  return (
    <Link href={`/roster/print/${weekStart}/${emp.id}`} className="text-xs font-medium text-brand-700 hover:underline">
      Printable view →
    </Link>
  );
}
