import { useMemo, useState } from "react";
import { format } from "date-fns";
import { trpc } from "../lib/trpc";
import { Button, Card, EmptyState, Input, Spinner, Table } from "../components/ui";

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

export default function Invoicing() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
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
    if (!data.data) return;
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
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Monthly invoice prep</h1>

      <div className="flex flex-wrap items-end gap-3">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button variant="secondary" onClick={downloadCsv} disabled={!data.data || data.data.length === 0}>
          Export CSV
        </Button>
      </div>

      {data.isLoading ? (
        <Spinner />
      ) : !data.data || data.data.length === 0 ? (
        <EmptyState>No completed jobs for this month yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          <Card className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Total revenue this month</span>
            <span className="text-xl font-bold text-brand-700">${grandTotal.toFixed(2)}</span>
          </Card>

          {grouped.map(([clientName, jobs]) => (
            <div key={clientName}>
              <h2 className="mb-1 font-semibold text-gray-900">{clientName}</h2>
              <Table>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
