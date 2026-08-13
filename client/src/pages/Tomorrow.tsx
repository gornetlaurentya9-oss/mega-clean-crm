import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Card, EmptyState, Spinner } from "../components/ui";

function buildMessage(job: any): string {
  const clientFirstName = job.clientName.split(" ")[0];
  const weekday = format(parseISO(job.scheduledDate), "EEEE");
  const employeeFirstName = job.employeeName ? job.employeeName.split(" ")[0] : "our team";
  const time = job.startTime;
  return `Hi ${clientFirstName}, just confirming your ${job.serviceType.toLowerCase()} tomorrow (${weekday}) at ${time} with ${employeeFirstName}. Reply if you need to reschedule!`;
}

export default function Tomorrow() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const jobs = trpc.jobs.upcomingReminders.useQuery({ date: tomorrow });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function copy(text: string, id?: number) {
    await navigator.clipboard.writeText(text);
    if (id != null) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    }
  }

  const messages = jobs.data?.map((j) => buildMessage(j)) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tomorrow's messages</h1>
          <p className="text-sm text-gray-500">{format(parseISO(tomorrow), "EEEE d MMMM yyyy")}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" onClick={() => copy(messages.join("\n\n"))}>
            {copiedAll ? "Copied all!" : "Copy all"}
          </Button>
        )}
      </div>

      {jobs.isLoading ? (
        <Spinner />
      ) : !jobs.data || jobs.data.length === 0 ? (
        <EmptyState>No confirmed or scheduled jobs for tomorrow.</EmptyState>
      ) : (
        <div className="space-y-3">
          {jobs.data.map((job) => (
            <Card key={job.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-gray-900">
                  {job.clientName} · {job.startTime}
                </div>
                <p className="mt-1 text-sm text-gray-600">{buildMessage(job)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => copy(buildMessage(job), job.id)}>
                {copiedId === job.id ? "Copied!" : "Copy"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
