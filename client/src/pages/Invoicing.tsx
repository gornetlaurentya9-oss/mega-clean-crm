import { useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Card, EmptyState, Input, Skeleton, Table } from "../components/ui";
import { useToast } from "../components/Toast";
import { formatCurrency } from "../lib/currency";
import { formatEmployeeNames } from "../lib/employeeNames";

function toCsv(rows: any[]): string {
  const headers = ["Client", "Service type", "Date", "Employee", "Hours", "Rate", "Rate type", "Total"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.clientName,
      r.serviceType,
      r.scheduledDate,
      formatEmployeeNames(r.employeeNames),
      r.actualHours ?? r.plannedDurationHours,
      r.billingRate,
      r.billingRateType,
      r.computedTotal,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function IconEuro({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6.5A7 7 0 1 0 18 17.5" />
      <path d="M4 10h11M4 14h11" />
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
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const toast = useToast();
  const rangeValid = from <= to;
  const data = trpc.jobs.monthlyExport.useQuery({ from, to }, { enabled: rangeValid });

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
    a.download = `mega-clean-invoicing-${from}_to_${to}.csv`;
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
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="secondary" onClick={downloadCsv} disabled={!data.data || data.data.length === 0}>
          <IconDownload className="h-4 w-4" />
          Export CSV
        </Button>
      </Card>

      {!rangeValid ? (
        <EmptyState>The "From" date must be on or before the "To" date.</EmptyState>
      ) : data.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !data.data || data.data.length === 0 ? (
        <EmptyState>No completed jobs in this date range yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          {/* Grand-total summary — the number the owner cares about most before sending to the
              accountant, so it gets the most prominent treatment on the page. */}
          <Card className="border-brand-secondary/20 bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-soft-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                  <IconEuro className="h-4 w-4" />
                  Total revenue — {format(new Date(`${from}T00:00:00`), "d MMM yyyy")} to{" "}
                  {format(new Date(`${to}T00:00:00`), "d MMM yyyy")}
                </div>
                <div className="mt-1 text-3xl font-bold sm:text-4xl">{formatCurrency(grandTotal)}</div>
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
                  <span className="text-sm font-bold text-brand-primary">{formatCurrency(clientTotal)}</span>
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
                        <td className="px-3 py-2">{formatEmployeeNames(j.employeeNames)}</td>
                        <td className="px-3 py-2">{j.actualHours ?? j.plannedDurationHours}</td>
                        <td className="px-3 py-2">
                          {j.billingRateType === "per-hour"
                            ? `${formatCurrency(j.billingRate)}/hr`
                            : `${formatCurrency(j.billingRate)}/visit`}
                        </td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(j.computedTotal)}</td>
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
