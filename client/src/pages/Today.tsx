import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { addDays, format, parseISO } from "date-fns";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, EmptyState, SkeletonList, cx } from "../components/ui";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SparkleIcon, TrashIcon } from "../components/Icons";
import { JobModal } from "../components/JobModal";
import { CompleteJobModal } from "../components/CompleteJobModal";
import { CancelJobModal } from "../components/CancelJobModal";
import { useToast } from "../components/Toast";
import { formatEmployeeNames } from "../lib/employeeNames";

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

const RESOLVED_STATUSES = ["completed", "cancelled", "cancelled-partial"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * The night-before/next-morning "clear today's outstanding jobs" screen — a filtered, focused
 * view over the same jobs data the roster already shows (not a separate system). Defaults to
 * today, with prev/next day nav for catching up on a day or two missed, or deep-links to a
 * specific day via an optional :date route param (e.g. from the roster's month calendar).
 * Reuses the existing CompleteJobModal/CancelJobModal (and jobs.complete/jobs.cancel
 * mutations) rather than duplicating that logic — same as Roster.tsx.
 */
export default function Today() {
  const params = useParams<{ date?: string }>();
  const [date, setDate] = useState(() => (params.date && DATE_RE.test(params.date) ? params.date : todayStr()));
  const [completeJob, setCompleteJob] = useState<any>(null);
  const [cancelJob, setCancelJob] = useState<any>(null);
  const [editJob, setEditJob] = useState<any>(null);
  const toast = useToast();
  const utils = trpc.useUtils();

  // wouter re-renders the same component instance across /today/:date navigations rather than
  // remounting it, so the lazily-initialized state above won't pick up a later param change on
  // its own — sync explicitly when the URL param changes (e.g. clicking a different day in the
  // roster's month calendar while already on this page).
  useEffect(() => {
    if (params.date && DATE_RE.test(params.date) && params.date !== date) {
      setDate(params.date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  const jobsQuery = trpc.jobs.list.useQuery({ from: date, to: date });
  const removeJob = trpc.jobs.remove.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      toast.success("Job removed");
    },
    onError: (err) => toast.error(err.message || "Could not remove this job"),
  });

  function handleDelete(job: any) {
    if (window.confirm(`Remove this ${job.serviceType} job for ${job.clientName} from the roster? This can't be undone.`)) {
      removeJob.mutate({ id: job.id });
    }
  }

  const jobs = useMemo(
    () => (jobsQuery.data ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [jobsQuery.data]
  );
  const resolvedCount = jobs.filter((j) => RESOLVED_STATUSES.includes(j.status)).length;
  const allResolved = jobs.length > 0 && resolvedCount === jobs.length;
  const isToday = date === todayStr();

  function goto(offset: number) {
    setDate(format(addDays(parseISO(date), offset), "yyyy-MM-dd"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{isToday ? "Today" : format(parseISO(date), "EEEE d MMMM")}</h1>
          <p className="text-sm text-gray-500">Confirm what actually happened, job by job.</p>
        </div>
      </div>

      <Card className="border-brand-secondary/20 bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-soft-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => goto(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-[10rem] text-center sm:min-w-[12rem]">
              <div className="text-base font-bold sm:text-lg">
                {isToday ? "Today" : format(parseISO(date), "EEEE")} · {format(parseISO(date), "d MMM yyyy")}
              </div>
              <div className="text-xs text-white/70">
                {jobsQuery.isLoading
                  ? "Loading…"
                  : jobs.length === 0
                    ? "No jobs this day"
                    : `${resolvedCount} of ${jobs.length} job${jobs.length === 1 ? "" : "s"} confirmed`}
              </div>
            </div>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => goto(1)}
              className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayStr())}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-white px-4 py-2 text-sm font-semibold text-brand-primary shadow-sm transition-all duration-150 hover:bg-brand-accent/10 active:scale-[0.97]"
            >
              Jump to today
            </button>
          )}
        </div>
      </Card>

      {jobsQuery.isLoading ? (
        <SkeletonList rows={3} />
      ) : jobs.length === 0 ? (
        <EmptyState>
          <p className="font-medium text-gray-600">Nothing scheduled for this day.</p>
        </EmptyState>
      ) : allResolved ? (
        <EmptyState>
          <span className="inline-flex items-center gap-1.5">
            <SparkleIcon size={16} className="text-brand-accent" />
            <span className="font-medium text-gray-600">All jobs for this day are confirmed.</span>
          </span>
        </EmptyState>
      ) : null}

      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job) => {
            const resolved = RESOLVED_STATUSES.includes(job.status);
            const cancelled = job.status === "cancelled" || job.status === "cancelled-partial";
            return (
              <Card
                key={job.id}
                className={cx(resolved ? "border-gray-200 bg-gray-50" : "border-brand-accent/30 bg-white")}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className={cx("min-w-0", cancelled && "opacity-60")}>
                    <div className={cx("font-semibold text-gray-900", cancelled && "line-through")}>
                      {job.startTime} · {job.clientName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {job.serviceType} · {formatEmployeeNames(job.employeeNames)} · {job.plannedDurationHours}h
                      {resolved && job.actualHours != null && <> · billed {job.actualHours}h</>}
                    </div>
                    {job.completionNotes && <div className="mt-1 text-xs text-gray-500">Notes: {job.completionNotes}</div>}
                  </div>
                  <Badge tone={statusTone[job.status] ?? "gray"}>{statusLabel[job.status] ?? job.status}</Badge>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {resolved ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditJob(job)}>
                        Edit
                      </Button>
                      {job.status === "completed" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setCancelJob(job)}
                          title="This was marked complete by mistake"
                        >
                          Reverse
                        </Button>
                      )}
                      {job.status === "cancelled" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(job)}
                          title="Remove entirely — not a cancellation"
                        >
                          <TrashIcon size={15} />
                          Remove
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => setCompleteJob(job)}>
                        <CheckIcon size={15} />
                        Mark complete
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setCancelJob(job)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(job)} title="Remove entirely — not a cancellation">
                        <TrashIcon size={15} />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <JobModal open={!!editJob} onClose={() => setEditJob(null)} job={editJob} />
      <CompleteJobModal open={!!completeJob} onClose={() => setCompleteJob(null)} job={completeJob} />
      <CancelJobModal open={!!cancelJob} onClose={() => setCancelJob(null)} job={cancelJob} />
    </div>
  );
}
