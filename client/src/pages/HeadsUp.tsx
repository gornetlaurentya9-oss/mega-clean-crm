import { useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Card, EmptyState, SkeletonList } from "../components/ui";
import { useToast } from "../components/Toast";
import { BellIcon, ChevronLeftIcon, ChevronRightIcon } from "../components/Icons";
import { joinEmployeeFirstNamesForMessage } from "../lib/employeeNames";

function IconCopy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function buildMessage(job: any): string {
  const clientFirstName = job.clientName.split(" ")[0];
  const weekday = format(parseISO(job.scheduledDate), "EEEE");
  const date = format(parseISO(job.scheduledDate), "d MMM");
  const withWho = joinEmployeeFirstNamesForMessage(job.employeeNames, "our team");
  return `Hi ${clientFirstName}, just a heads-up — you're booked in for your ${job.serviceType.toLowerCase()} on ${weekday} ${date} at ${job.startTime} with ${withWho}. Let me know if that doesn't work for you!`;
}

/**
 * "Heads-up" messages: a message-drafting screen only, exactly like Tomorrow's messages, but for
 * every scheduled/confirmed job in whichever upcoming week is selected (not hard-coded to
 * literally next week — reuses the same week-nav pattern as Roster.tsx's "Generate this week").
 * Copying (or not copying) a message here has no effect on anything else in the app — there's no
 * "all clients replied" gate anywhere. If a client responds with an issue, the owner flags it
 * herself from the roster ("Mark: client requested change").
 */
export default function HeadsUp() {
  const [weekStart, setWeekStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const jobsQuery = trpc.jobs.list.useQuery({ from: weekStart, to: weekEnd });
  const toast = useToast();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const jobs = useMemo(
    () =>
      (jobsQuery.data ?? [])
        .filter((j) => j.status === "scheduled" || j.status === "confirmed")
        .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime)),
    [jobsQuery.data]
  );

  async function copy(text: string, id?: number) {
    await navigator.clipboard.writeText(text);
    if (id != null) {
      setCopiedId(id);
      toast.success("Copied!");
      setTimeout(() => setCopiedId(null), 1500);
    } else {
      setCopiedAll(true);
      toast.success("All messages copied!");
      setTimeout(() => setCopiedAll(false), 1500);
    }
  }

  const messages = jobs.map((j) => buildMessage(j));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Heads-up messages</h1>
          <p className="text-sm text-gray-500">Draft a booking heads-up for every upcoming job — copy and send manually.</p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" onClick={() => copy(messages.join("\n\n"))}>
            <IconCopy className="h-4 w-4" />
            {copiedAll ? "Copied all!" : "Copy all"}
          </Button>
        )}
      </div>

      {/* Week nav — same pattern as the roster's week picker: not hard-coded to next week. */}
      <Card className="border-brand-secondary/20 bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-soft-lg">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekStart(format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd"))}
            className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-[10rem] text-center sm:min-w-[12rem]">
            <div className="text-base font-bold sm:text-lg">
              {format(parseISO(weekStart), "d MMM")} – {format(parseISO(weekEnd), "d MMM yyyy")}
            </div>
            <div className="text-xs text-white/70">
              {jobsQuery.isLoading ? "Loading…" : `${messages.length} message${messages.length === 1 ? "" : "s"} to send`}
            </div>
          </div>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekStart(format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd"))}
            className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </Card>

      {jobsQuery.isLoading ? (
        <SkeletonList rows={3} />
      ) : jobs.length === 0 ? (
        <EmptyState>
          <p className="font-medium text-gray-600">No scheduled or confirmed jobs this week.</p>
          <p className="mt-1 text-sm">Nothing to send heads-up messages for right now.</p>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-brand-navy">
                    <BellIcon className="h-4 w-4 shrink-0 text-brand-accent" />
                    {job.clientName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {format(parseISO(job.scheduledDate), "EEE d MMM")} · {job.startTime} · {job.serviceType}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => copy(buildMessage(job), job.id)}>
                  <IconCopy className="h-3.5 w-3.5" />
                  {copiedId === job.id ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="rounded-control border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
                {buildMessage(job)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
