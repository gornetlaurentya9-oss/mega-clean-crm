import { useEffect } from "react";
import { useParams } from "wouter";
import { addDays, format, parseISO } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Spinner } from "../components/ui";
import { Logo } from "../components/Logo";

export default function PrintWeek() {
  const { weekStart, employeeId } = useParams();
  const weekEnd = format(addDays(parseISO(weekStart!), 6), "yyyy-MM-dd");
  const jobs = trpc.jobs.list.useQuery({ from: weekStart, to: weekEnd });
  const employee = trpc.employees.byId.useQuery({ id: Number(employeeId) });

  useEffect(() => {
    document.title = "Weekly schedule";
  }, []);

  if (jobs.isLoading || employee.isLoading) return <Spinner />;

  // A job assigned to more than one employee (two cleaners on one visit) must appear on every
  // one of their printed pages, not just the first — hence checking membership in employeeIds
  // rather than a single equality check against the old singular employeeId.
  const myJobs = (jobs.data ?? [])
    .filter((j) => (j.employeeIds ?? []).includes(Number(employeeId)) && j.status !== "cancelled")
    .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime));

  return (
    <div className="mx-auto max-w-2xl bg-white p-4 print:p-0">
      <div className="no-print mb-4">
        <Button onClick={() => window.print()}>Print this page</Button>
      </div>

      <div className="mb-3">
        <Logo variant="dark" size="sm" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Weekly schedule — {employee.data?.name}</h1>
      <p className="mb-4 text-sm text-gray-500">
        {format(parseISO(weekStart!), "d MMM")} – {format(parseISO(weekEnd), "d MMM yyyy")}
      </p>

      {myJobs.length === 0 ? (
        <p className="text-gray-500">No jobs scheduled this week.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[560px] border-collapse text-sm print:min-w-0">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-2 pr-2">Day</th>
                <th className="py-2 pr-2">Time</th>
                <th className="py-2 pr-2">Client</th>
                <th className="py-2 pr-2">Address</th>
                <th className="py-2 pr-2">Service</th>
                <th className="py-2 pr-2">Duration</th>
                <th className="py-2">With</th>
              </tr>
            </thead>
            <tbody>
              {myJobs.map((j) => {
                // Other employee(s) sharing this job — a house cleaned by two people at once —
                // so it's clear on the printed page who else is expected on site.
                const others = (j.employeeNames ?? []).filter((n: string, i: number) => (j.employeeIds ?? [])[i] !== Number(employeeId));
                return (
                  <tr key={j.id} className="border-b border-gray-200 align-top">
                    <td className="py-2 pr-2">{format(parseISO(j.scheduledDate), "EEE d MMM")}</td>
                    <td className="py-2 pr-2">{j.startTime}</td>
                    <td className="py-2 pr-2">{j.clientName}</td>
                    <td className="py-2 pr-2">{j.clientAddress}</td>
                    <td className="py-2 pr-2">{j.serviceType}</td>
                    <td className="py-2 pr-2">{j.plannedDurationHours}h</td>
                    <td className="py-2 text-gray-500">{others.length > 0 ? others.join(", ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
