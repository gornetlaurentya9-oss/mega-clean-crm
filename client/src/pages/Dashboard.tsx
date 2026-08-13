import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Card, Spinner } from "../components/ui";

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

export default function Dashboard() {
  const summary = trpc.dashboard.summary.useQuery();

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
    </div>
  );
}
