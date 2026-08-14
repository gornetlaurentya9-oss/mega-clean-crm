import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Card, EmptyState, SkeletonList } from "../components/ui";
import { useToast } from "../components/Toast";

function buildMessage(job: any): string {
  const clientFirstName = job.clientName.split(" ")[0];
  const weekday = format(parseISO(job.scheduledDate), "EEEE");
  const employeeFirstName = job.employeeName ? job.employeeName.split(" ")[0] : "our team";
  const time = job.startTime;
  return `Hi ${clientFirstName}, just confirming your ${job.serviceType.toLowerCase()} tomorrow (${weekday}) at ${time} with ${employeeFirstName}. Reply if you need to reschedule!`;
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function IconMessage({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function Tomorrow() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const jobs = trpc.jobs.upcomingReminders.useQuery({ date: tomorrow });
  const toast = useToast();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

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

  const messages = jobs.data?.map((j) => buildMessage(j)) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Tomorrow's messages</h1>
          <p className="text-sm text-gray-500">{format(parseISO(tomorrow), "EEEE d MMMM yyyy")}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" onClick={() => copy(messages.join("\n\n"))}>
            <IconCopy className="h-4 w-4" />
            {copiedAll ? "Copied all!" : "Copy all"}
          </Button>
        )}
      </div>

      {jobs.isLoading ? (
        <SkeletonList rows={3} />
      ) : !jobs.data || jobs.data.length === 0 ? (
        <EmptyState>
          <p className="font-medium text-gray-600">No confirmed or scheduled jobs for tomorrow.</p>
          <p className="mt-1 text-sm">Nothing to send reminders for right now.</p>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {jobs.data.map((job) => (
            <Card key={job.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-brand-navy">
                    <IconMessage className="h-4 w-4 shrink-0 text-brand-accent" />
                    {job.clientName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {job.startTime} · {job.serviceType}
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
