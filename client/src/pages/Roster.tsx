import { useMemo, useState } from "react";
import { Link } from "wouter";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, EmptyState, Skeleton, cx } from "../components/ui";
import { MessageAlertIcon } from "../components/Icons";
import { useToast } from "../components/Toast";
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

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.9 18a1.6 1.6 0 0 0 1.4 2.5h17.4a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9v4M12 16.5h.01" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M4 12h4M16 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </svg>
  );
}

function IconPrinter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconClockArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="12" r="8" />
      <path d="M11 8v4l2.5 1.5M19 8v-3M19 8l2-1.3M19 8l-2-1.3" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Small square icon-button used for the per-job action row — keeps a 44px tap target on mobile
 *  without needing a full label on every button. */
function ActionIconButton({
  label,
  tone = "default",
  onClick,
  children,
}: {
  label: string;
  tone?: "default" | "primary" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "border-brand-accent/40 text-brand-primary hover:bg-brand-accent/10 hover:border-brand-accent"
      : tone === "danger"
        ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
        : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-control border bg-white transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1",
        toneClass
      )}
    >
      {children}
    </button>
  );
}

export default function Roster() {
  const [weekStart, setWeekStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [view, setView] = useState<"day" | "employee" | "calendar">("day");
  const [editJob, setEditJob] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [completeJob, setCompleteJob] = useState<any>(null);
  const [cancelJob, setCancelJob] = useState<any>(null);
  const [rescheduleJob, setRescheduleJob] = useState<any>(null);

  const toast = useToast();
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const utils = trpc.useUtils();
  const jobs = trpc.jobs.list.useQuery({ from: weekStart, to: weekEnd });
  const conflicts = trpc.jobs.conflicts.useQuery({ from: weekStart, to: weekEnd });
  const employees = trpc.employees.list.useQuery({ status: "active" });

  const generate = trpc.jobs.generateWeek.useMutation({
    onSuccess: (res) => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      toast.success(`Generated ${res.created} job${res.created === 1 ? "" : "s"}. Skipped ${res.skipped.length} (already existed).`);
    },
    onError: () => toast.error("Could not generate this week"),
  });

  // Independent of job status/conflicts — the owner flags/clears this herself after hearing back
  // from a client (phone/text) about a "heads-up" message. Doesn't gate or block anything else.
  const setResponseStatus = trpc.jobs.setClientResponseStatus.useMutation({
    onSuccess: (row) => {
      utils.jobs.list.invalidate();
      toast.success(
        row?.clientResponseStatus === "change-requested" ? "Flagged: client requested a change" : "Marked confirmed"
      );
    },
    onError: () => toast.error("Could not update client response status"),
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

  const totalJobsThisWeek = jobs.data?.length ?? 0;

  function JobRow({ job }: { job: any }) {
    const jobConflicts = conflictsByJob.get(job.id) ?? [];
    const hasConflict = jobConflicts.length > 0;
    const changeRequested = job.clientResponseStatus === "change-requested";
    const cancelled = job.status === "cancelled" || job.status === "cancelled-partial";
    const completed = job.status === "completed";

    const responseToggle = (
      <ActionIconButton
        label={changeRequested ? "Mark confirmed" : "Mark: client requested change"}
        tone={changeRequested ? "primary" : "default"}
        onClick={() =>
          setResponseStatus.mutate({ id: job.id, clientResponseStatus: changeRequested ? "confirmed" : "change-requested" })
        }
      >
        <MessageAlertIcon className="h-4 w-4" />
      </ActionIconButton>
    );

    return (
      <div
        className={cx(
          "rounded-panel border p-3 shadow-soft transition-colors duration-150",
          hasConflict || changeRequested
            ? "border-amber-300 bg-amber-50"
            : cancelled
              ? "border-gray-200 bg-gray-50"
              : "border-gray-200 bg-white"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className={cx("min-w-0", cancelled && "opacity-60")}>
            <div className={cx("font-semibold text-gray-900", cancelled && "line-through")}>
              {job.startTime} · {job.clientName}
            </div>
            <div className="text-xs text-gray-500">
              {job.serviceType} · {job.employeeName ?? "Unassigned"} · {job.plannedDurationHours}h
              {job.status === "cancelled-partial" && job.actualHours != null && <> · billed {job.actualHours}h</>}
            </div>
          </div>
          <Badge tone={statusTone[job.status] ?? "gray"}>{statusLabel[job.status] ?? job.status}</Badge>
        </div>

        {hasConflict && (
          <div className="mt-2 space-y-1 rounded-control border border-amber-300 bg-amber-100/60 p-2">
            {jobConflicts.map((m, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs font-medium text-amber-900">
                <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{m}</span>
              </div>
            ))}
          </div>
        )}

        {changeRequested && (
          <div className="mt-2 flex items-start gap-1.5 rounded-control border border-amber-300 bg-amber-100/60 p-2 text-xs font-medium text-amber-900">
            <MessageAlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Client requested a change</span>
          </div>
        )}

        {!completed && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <ActionIconButton label="Edit job" tone="primary" onClick={() => setEditJob(job)}>
              <IconEdit className="h-4 w-4" />
            </ActionIconButton>
            {responseToggle}
            {!cancelled && (
              <>
                <ActionIconButton label="Mark complete" tone="primary" onClick={() => setCompleteJob(job)}>
                  <IconCheck className="h-4 w-4" />
                </ActionIconButton>
                <ActionIconButton label="Reschedule" tone="default" onClick={() => setRescheduleJob(job)}>
                  <IconClockArrow className="h-4 w-4" />
                </ActionIconButton>
                <ActionIconButton label="Cancel job" tone="danger" onClick={() => setCancelJob(job)}>
                  <IconX className="h-4 w-4" />
                </ActionIconButton>
              </>
            )}
          </div>
        )}
        {completed && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <ActionIconButton label="Edit job" tone="primary" onClick={() => setEditJob(job)}>
              <IconEdit className="h-4 w-4" />
            </ActionIconButton>
            {responseToggle}
          </div>
        )}
      </div>
    );
  }

  /** Compact card used in the calendar-grid view — click opens the same edit/action modal as the
   *  other views. Shows the same status/conflict/client-response badges for consistency. */
  function CalendarJobCard({ job }: { job: any }) {
    const jobConflicts = conflictsByJob.get(job.id) ?? [];
    const hasConflict = jobConflicts.length > 0;
    const changeRequested = job.clientResponseStatus === "change-requested";
    const cancelled = job.status === "cancelled" || job.status === "cancelled-partial";
    return (
      <button
        type="button"
        onClick={() => setEditJob(job)}
        className={cx(
          "w-full rounded-control border p-2 text-left text-xs shadow-soft transition-all duration-150 hover:shadow-soft-lg active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
          hasConflict || changeRequested
            ? "border-amber-300 bg-amber-50"
            : cancelled
              ? "border-gray-200 bg-gray-50"
              : "border-gray-200 bg-white"
        )}
      >
        <div className={cx("font-semibold text-gray-900", cancelled && "opacity-60 line-through")}>
          {job.startTime} · {job.clientName}
        </div>
        <div className={cx("mt-0.5 text-gray-500", cancelled && "opacity-60")}>{job.employeeName ?? "Unassigned"}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone[job.status] ?? "gray"}>{statusLabel[job.status] ?? job.status}</Badge>
          {hasConflict && <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
          {changeRequested && <MessageAlertIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-navy">Weekly roster</h1>
        <Button onClick={() => setAddOpen(true)}>+ One-off job</Button>
      </div>

      {/* Header bar: week nav + generate action, given prominent brand treatment since this is
          the primary control surface for the week. */}
      <Card className="border-brand-secondary/20 bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-soft-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekStart(format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd"))}
              className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-[10rem] text-center sm:min-w-[12rem]">
              <div className="text-base font-bold sm:text-lg">
                {format(parseISO(weekStart), "d MMM")} – {format(parseISO(weekEnd), "d MMM yyyy")}
              </div>
              <div className="text-xs text-white/70">
                {jobs.isLoading ? "Loading…" : `${totalJobsThisWeek} job${totalJobsThisWeek === 1 ? "" : "s"} this week`}
              </div>
            </div>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekStart(format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd"))}
              className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <IconChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => generate.mutate({ weekStart })}
            disabled={generate.isPending}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-white px-4 py-2 text-sm font-semibold text-brand-primary shadow-sm transition-all duration-150 hover:bg-brand-accent/10 active:scale-[0.97] disabled:opacity-60"
          >
            <IconSparkles className="h-4 w-4" />
            {generate.isPending ? "Generating…" : "Generate this week"}
          </button>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant={view === "day" ? "primary" : "secondary"} onClick={() => setView("day")}>
          By day
        </Button>
        <Button size="sm" variant={view === "employee" ? "primary" : "secondary"} onClick={() => setView("employee")}>
          By employee
        </Button>
        <Button size="sm" variant={view === "calendar" ? "primary" : "secondary"} onClick={() => setView("calendar")}>
          Calendar
        </Button>
      </div>

      {jobs.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : totalJobsThisWeek === 0 ? (
        <EmptyState>
          <p className="font-medium text-gray-600">Nothing generated for this week yet.</p>
          <p className="mt-1 text-sm">Use "Generate this week" to build the roster from recurring patterns, or add a one-off job.</p>
        </EmptyState>
      ) : view === "calendar" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {days.map((d) => {
              const dayJobs = (byDay.get(d) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const weekday = format(parseISO(d), "EEE");
              return (
                <div key={d} className="w-52 shrink-0">
                  <h2 className="mb-1.5 text-sm font-semibold text-brand-navy">
                    {weekday} <span className="font-normal text-gray-400">{format(parseISO(d), "d MMM")}</span>
                  </h2>
                  <div className="space-y-2">
                    {dayJobs.length === 0 ? (
                      <p className="rounded-control border border-dashed border-gray-200 p-2 text-xs text-gray-400">No jobs.</p>
                    ) : (
                      dayJobs.map((j) => <CalendarJobCard key={j.id} job={j} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "day" ? (
        <div className="space-y-5">
          {days.map((d) => {
            const dayJobs = (byDay.get(d) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const weekday = format(parseISO(d), "EEEE");
            return (
              <div key={d}>
                <h2 className="mb-1.5 font-semibold text-brand-navy">
                  {weekday} <span className="font-normal text-gray-400">{format(parseISO(d), "d MMM")}</span>
                </h2>
                {dayJobs.length === 0 ? (
                  <p className="rounded-control border border-dashed border-gray-200 p-3 text-sm text-gray-400">No jobs.</p>
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
        <div className="space-y-5">
          {byEmployee.map(([name, empJobs]) => (
            <div key={name}>
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="font-semibold text-brand-navy">{name}</h2>
                {name !== "Unassigned" && <PrintLink weekStart={weekStart} employeeName={name} employees={employees.data} />}
              </div>
              <div className="space-y-2">
                {empJobs
                  .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
                  .map((j) => (
                    <JobRow key={j.id} job={j} />
                  ))}
              </div>
            </div>
          ))}
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
    <Link
      href={`/roster/print/${weekStart}/${emp.id}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
    >
      <IconPrinter className="h-3.5 w-3.5" />
      Printable view
    </Link>
  );
}
