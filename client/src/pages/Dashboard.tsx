import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, EmptyState, Spinner } from "../components/ui";
import { CompleteJobModal } from "../components/CompleteJobModal";

function StatCard({ label, value, href, tone }: { label: string; value: string; href: string; tone?: "warn" }) {
  return (
    <Link href={href}>
      <Card className={tone === "warn" ? "border-yellow-300 bg-yellow-50" : ""}>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
      </Card>
    </Link>
  );
}

function dayLabel(dateStr: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (dateStr === today) return "Today";
  return format(parseISO(dateStr), "EEE d MMM");
}

export default function Dashboard() {
  const summary = trpc.dashboard.summary.useQuery();
  const details = trpc.dashboard.details.useQuery();
  const [completeJob, setCompleteJob] = useState<any>(null);

  if (summary.isLoading || !summary.data) return <Spinner />;

  const { weekJobCount, monthRevenueToDate, jobsAwaitingCompletion, conflictCount } = summary.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Jobs this week" value={String(weekJobCount)} href="/roster" />
        <StatCard label="Revenue MTD" value={`$${monthRevenueToDate.toFixed(2)}`} href="/invoicing" />
        <StatCard
          label="Roster conflicts"
          value={String(conflictCount)}
          href="/roster"
          tone={conflictCount > 0 ? "warn" : undefined}
        />
        <StatCard
          label="Awaiting completion"
          value={String(jobsAwaitingCompletion)}
          href="/roster"
          tone={jobsAwaitingCompletion > 0 ? "warn" : undefined}
        />
      </div>

      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/roster" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Go to weekly roster
          </Link>
          <Link href="/tomorrow" className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Tomorrow's messages
          </Link>
          <Link href="/clients" className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Add a client
          </Link>
        </div>
      </Card>

      {details.isLoading || !details.data ? (
        <Spinner />
      ) : (
        <>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Today &amp; tomorrow</h2>
              <Link href="/roster" className="text-xs font-medium text-brand-700 hover:underline">
                Full roster →
              </Link>
            </div>
            {details.data.upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing left scheduled today or tomorrow.</p>
            ) : (
              <ul className="space-y-2">
                {details.data.upcoming.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-gray-500">{dayLabel(j.scheduledDate)}</span> {j.startTime} ·{" "}
                      {j.clientName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{j.employeeName ?? "Unassigned"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className={conflictCount > 0 ? "border-red-300 bg-red-50" : ""}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Active conflicts</h2>
              <Link href="/roster" className="text-xs font-medium text-brand-700 hover:underline">
                Fix in roster →
              </Link>
            </div>
            {details.data.conflictDetails.length === 0 ? (
              <p className="text-sm text-gray-500">No conflicts right now. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {details.data.conflictDetails.map((c, i) => (
                  <li key={`${c.jobId}-${i}`} className="rounded-lg border border-red-200 bg-white p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="red">{c.type.replace("-", " ")}</Badge>
                      {c.scheduledDate && <span className="text-xs text-gray-500">{dayLabel(c.scheduledDate)} {c.startTime}</span>}
                    </div>
                    <p className="mt-1 text-gray-700">{c.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className={details.data.awaiting.length > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
            <h2 className="mb-2 font-semibold text-gray-900">Awaiting completion</h2>
            {details.data.awaiting.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing overdue for completion.</p>
            ) : (
              <ul className="space-y-2">
                {details.data.awaiting.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-2 text-sm">
                    <span className="min-w-0 truncate">
                      {j.scheduledDate} · {j.clientName} · {j.employeeName ?? "Unassigned"}
                    </span>
                    <Button size="sm" onClick={() => setCompleteJob(j)}>
                      Mark complete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <CompleteJobModal open={!!completeJob} onClose={() => setCompleteJob(null)} job={completeJob} />
    </div>
  );
}
