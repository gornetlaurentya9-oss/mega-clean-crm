import { useMemo, useState } from "react";
import { format } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Card, EmptyState, Input, Skeleton, Table } from "../components/ui";
import { useToast } from "../components/Toast";

function toCsv(rows: any[]): string {
  const headers = ["Client", "Service type", "Date", "Employee", "Hours", "Rate", "Rate type", "Total"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.clientName,
      r.serviceType,
      r.scheduledDate,
      r.employeeName ?? "",
      r.actualHours ?? r.plannedDurationHours,
      r.billingRate,
      r.billingRateType,
      r.computedTotal,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function IconDollar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 6.5c0-1.7-2.2-3-5-3s-5 1.3-5 3 2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3" />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export default function Invoicing() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const toast = useToast();
  const data = trpc.jobs.monthlyExport.useQuery({ month });

  const grouped = useMemo(() => {
    if (!data.data) return [];
    const map = new Map<string, typeof data.data>();
    for (const job of data.data) {
      const list = map.get(job.clientName) ?? [];
      list.push(job);
      map.set(job.clientName, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.data]);

  const grandTotal = data.data?.reduce((sum, j) => sum + j.computedTotal, 0) ?? 0;

  function downloadCsv() {
    if (!data.data || data.data.length === 0) return;
    const csv = toCsv(data.data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mega-clean-invoicing-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Monthly invoice prep</h1>

      <Card className="flex flex-wrap items-end justify-between gap-3">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button variant="secondary" onClick={downloadCsv} disabled={!data.data || data.data.length === 0}>
          <IconDownload className="h-4 w-4" />
          Export CSV
        </Button>
      </Card>

      {data.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !data.data || data.data.length === 0 ? (
        <EmptyState>No completed jobs for this month yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          {/* Grand-total summary — the number the owner cares about most before sending to the
              accountant, so it gets the most prominent treatment on the page. */}
          <Card className="border-brand-secondary/20 bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-soft-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                  <IconDollar className="h-4 w-4" />
                  Total revenue — {format(new Date(`${month}-01T00:00:00`), "MMMM yyyy")}
                </div>
                <div className="mt-1 text-3xl font-bold sm:text-4xl">${grandTotal.toFixed(2)}</div>
              </div>
              <div className="text-right text-sm text-white/80">
                {data.data.length} job{data.data.length === 1 ? "" : "s"}
                <br />
                {grouped.length} client{grouped.length === 1 ? "" : "s"}
              </div>
            </div>
          </Card>

          {grouped.map(([clientName, jobs]) => {
            const clientTotal = jobs.reduce((sum, j) => sum + j.computedTotal, 0);
            return (
              <Card key={clientName} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-brand-navy">{clientName}</h2>
                  <span className="text-sm font-bold text-brand-primary">${clientTotal.toFixed(2)}</span>
                </div>
                <Table className="border-gray-100 shadow-none">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Hours</th>
                      <th className="px-3 py-2">Rate</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="px-3 py-2">{j.scheduledDate}</td>
                        <td className="px-3 py-2">{j.serviceType}</td>
                        <td className="px-3 py-2">{j.employeeName ?? "—"}</td>
                        <td className="px-3 py-2">{j.actualHours ?? j.plannedDurationHours}</td>
                        <td className="px-3 py-2">
                          {j.billingRateType === "per-hour" ? `$${j.billingRate}/hr` : `$${j.billingRate}/visit`}
                        </td>
                        <td className="px-3 py-2 font-medium">${j.computedTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
