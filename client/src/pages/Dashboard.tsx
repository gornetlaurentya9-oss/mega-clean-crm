import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, EmptyState, Skeleton, SkeletonList } from "../components/ui";
import { CompleteJobModal } from "../components/CompleteJobModal";
import { ArrowRightIcon, SparkleIcon } from "../components/Icons";

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 6.5c0-1.7-2.2-3-5-3s-5 1.3-5 3 2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.9 18a1.6 1.6 0 0 0 1.4 2.5h17.4a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9v4M12 16.5h.01" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  href,
  tone,
  icon,
}: {
  label: string;
  value: string;
  href: string;
  tone?: "warn";
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card
        className={
          tone === "warn"
            ? "border-brand-accent/40 bg-gradient-to-br from-brand-accent/10 to-white transition-all duration-150 hover:shadow-soft-lg"
            : "transition-all duration-150 hover:shadow-soft-lg"
        }
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <span className={tone === "warn" ? "text-brand-primary" : "text-brand-accent"}>{icon}</span>
          {label}
        </div>
        <div className="mt-2 text-3xl font-bold text-brand-navy">{value}</div>
      </Card>
    </Link>
  );
}

function SectionCard({
  title,
  icon,
  href,
  hrefLabel,
  toneClass,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  toneClass?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={toneClass}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-brand-navy">
          <span className="text-brand-primary">{icon}</span>
          {title}
        </h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-primary hover:underline">
            {hrefLabel} <ArrowRightIcon size={13} />
          </Link>
        )}
      </div>
      {children}
    </Card>
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

  if (summary.isLoading || !summary.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-navy">Overview</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-panel border border-gray-100 bg-white p-4 shadow-soft">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-8 w-1/2" />
            </div>
          ))}
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  const { weekJobCount, monthRevenueToDate, jobsAwaitingCompletion, conflictCount } = summary.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Overview</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Jobs this week" value={String(weekJobCount)} href="/roster" icon={<IconCalendar />} />
        <StatCard label="Revenue MTD" value={`$${monthRevenueToDate.toFixed(2)}`} href="/invoicing" icon={<IconDollar />} />
        <StatCard
          label="Roster conflicts"
          value={String(conflictCount)}
          href="/roster"
          tone={conflictCount > 0 ? "warn" : undefined}
          icon={<IconAlert />}
        />
        <StatCard
          label="Awaiting completion"
          value={String(jobsAwaitingCompletion)}
          href="/roster"
          tone={jobsAwaitingCompletion > 0 ? "warn" : undefined}
          icon={<IconClock />}
        />
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-brand-navy">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/roster"
            className="inline-flex min-h-[44px] items-center rounded-control bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-accent"
          >
            Go to weekly roster
          </Link>
          <Link
            href="/tomorrow"
            className="inline-flex min-h-[44px] items-center rounded-control border border-brand-secondary/40 bg-white px-4 py-2 text-sm font-medium text-brand-primary transition-colors duration-150 hover:bg-brand-accent/10 hover:border-brand-accent"
          >
            Tomorrow's messages
          </Link>
          <Link
            href="/clients"
            className="inline-flex min-h-[44px] items-center rounded-control border border-brand-secondary/40 bg-white px-4 py-2 text-sm font-medium text-brand-primary transition-colors duration-150 hover:bg-brand-accent/10 hover:border-brand-accent"
          >
            Add a client
          </Link>
        </div>
      </Card>

      {details.isLoading || !details.data ? (
        <SkeletonList rows={3} />
      ) : (
        <>
          <SectionCard title="Today & tomorrow" icon={<IconSun />} href="/roster" hrefLabel="Full roster">
            {details.data.upcoming.length === 0 ? (
              <EmptyState>Nothing left scheduled today or tomorrow.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {details.data.upcoming.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-control border border-gray-200 p-3 text-sm transition-colors duration-150 hover:bg-brand-accent/5"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-brand-primary">{dayLabel(j.scheduledDate)}</span> {j.startTime} ·{" "}
                      {j.clientName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{j.employeeName ?? "Unassigned"}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Active conflicts"
            icon={<IconAlert />}
            href="/roster"
            hrefLabel="Fix in roster"
            toneClass={conflictCount > 0 ? "border-red-300 bg-red-50" : undefined}
          >
            {details.data.conflictDetails.length === 0 ? (
              <EmptyState>
                <span className="inline-flex items-center gap-1.5">
                  <SparkleIcon size={16} className="text-brand-accent" /> No conflicts right now.
                </span>
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {details.data.conflictDetails.map((c, i) => (
                  <li key={`${c.jobId}-${i}`} className="rounded-control border border-red-200 bg-white p-3 text-sm shadow-soft">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="red">{c.type.replace("-", " ")}</Badge>
                      {c.scheduledDate && (
                        <span className="text-xs text-gray-500">
                          {dayLabel(c.scheduledDate)} {c.startTime}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-gray-700">{c.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Awaiting completion"
            icon={<IconClock />}
            toneClass={details.data.awaiting.length > 0 ? "border-brand-accent/40 bg-brand-accent/5" : undefined}
          >
            {details.data.awaiting.length === 0 ? (
              <EmptyState>Nothing overdue for completion.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {details.data.awaiting.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-control border border-gray-200 bg-white p-3 text-sm shadow-soft"
                  >
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
          </SectionCard>
        </>
      )}

      <CompleteJobModal open={!!completeJob} onClose={() => setCompleteJob(null)} job={completeJob} />
    </div>
  );
}
