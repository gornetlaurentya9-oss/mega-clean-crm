import { useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, EmptyState, Spinner } from "../components/ui";
import {
  CLIENT_CSV_COLUMNS,
  EMPLOYEE_CSV_COLUMNS,
  parseClientsCsv,
  parseEmployeesCsv,
  type ParsedRow,
  type ClientCsvRow,
  type EmployeeCsvRow,
} from "../lib/csvImport";

type Tab = "clients" | "employees";
type CommitResult = { rowNumber: number; name: string; ok: boolean; message: string };

export default function Import() {
  const [tab, setTab] = useState<Tab>("clients");
  const [fileName, setFileName] = useState("");
  const [clientRows, setClientRows] = useState<ParsedRow<ClientCsvRow>[] | null>(null);
  const [employeeRows, setEmployeeRows] = useState<ParsedRow<EmployeeCsvRow>[] | null>(null);
  const [results, setResults] = useState<CommitResult[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const existingClients = trpc.clients.list.useQuery();
  const existingEmployees = trpc.employees.list.useQuery();
  const createClient = trpc.clients.create.useMutation();
  const createEmployee = trpc.employees.create.useMutation();

  function switchTab(t: Tab) {
    setTab(t);
    setFileName("");
    setClientRows(null);
    setEmployeeRows(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (tab === "clients") {
        setClientRows(
          parseClientsCsv(
            text,
            (existingClients.data ?? []).map((c) => ({ name: c.name, phone: c.phone })),
            (existingEmployees.data ?? []).map((emp) => ({ id: emp.id, name: emp.name }))
          )
        );
        setEmployeeRows(null);
      } else {
        setEmployeeRows(
          parseEmployeesCsv(
            text,
            (existingEmployees.data ?? []).map((emp) => ({ name: emp.name, phone: emp.phone }))
          )
        );
        setClientRows(null);
      }
    };
    reader.readAsText(file);
  }

  const rows = tab === "clients" ? clientRows : employeeRows;
  const importable = (rows ?? []).filter((r) => r.data && !r.isDuplicate);
  const blocked = (rows ?? []).filter((r) => r.errors.length > 0);
  const duplicates = (rows ?? []).filter((r) => r.isDuplicate);

  async function commit() {
    if (!rows) return;
    setCommitting(true);
    const out: CommitResult[] = [];
    if (tab === "clients") {
      for (const row of clientRows ?? []) {
        if (!row.data || row.isDuplicate) continue;
        try {
          await createClient.mutateAsync(row.data as any);
          out.push({ rowNumber: row.rowNumber, name: row.data.name, ok: true, message: "Imported" });
        } catch (err: any) {
          out.push({ rowNumber: row.rowNumber, name: row.data.name, ok: false, message: err?.message ?? "Failed" });
        }
      }
      utils.clients.list.invalidate();
    } else {
      for (const row of employeeRows ?? []) {
        if (!row.data || row.isDuplicate) continue;
        try {
          await createEmployee.mutateAsync(row.data as any);
          out.push({ rowNumber: row.rowNumber, name: row.data.name, ok: true, message: "Imported" });
        } catch (err: any) {
          out.push({ rowNumber: row.rowNumber, name: row.data.name, ok: false, message: err?.message ?? "Failed" });
        }
      }
      utils.employees.list.invalidate();
    }
    setResults(out);
    setCommitting(false);
  }

  const columns = tab === "clients" ? CLIENT_CSV_COLUMNS : EMPLOYEE_CSV_COLUMNS;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Import from CSV</h1>
      <p className="text-sm text-gray-600">
        Bulk-add clients or employees from a spreadsheet. Nothing is saved until you review the preview
        below and confirm — see the README for the exact column format.
      </p>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "clients" ? "primary" : "secondary"} onClick={() => switchTab("clients")}>
          Clients
        </Button>
        <Button size="sm" variant={tab === "employees" ? "primary" : "secondary"} onClick={() => switchTab("employees")}>
          Employees
        </Button>
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium text-gray-700">
          Expected columns (first row must be a header row, in this order):
        </p>
        <p className="mb-3 break-words rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-600">
          {columns.join(", ")}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-[40px] file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
        />
        {fileName && <p className="mt-2 text-xs text-gray-500">Loaded: {fileName}</p>}
      </Card>

      {rows && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{importable.length} will import</Badge>
            {duplicates.length > 0 && <Badge tone="yellow">{duplicates.length} duplicate (skipped)</Badge>}
            {blocked.length > 0 && <Badge tone="red">{blocked.length} has errors (skipped)</Badge>}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={r.errors.length > 0 ? "bg-red-50" : r.isDuplicate ? "bg-yellow-50" : ""}>
                    <td className="px-3 py-2 text-gray-500">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-medium">{r.raw["name"] || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{r.raw["phone"] || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">
                      {r.errors.length > 0 ? (
                        <Badge tone="red">Error</Badge>
                      ) : r.isDuplicate ? (
                        <Badge tone="yellow">Duplicate</Badge>
                      ) : (
                        <Badge tone="green">Ready</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {[...r.errors, ...r.warnings].map((m, i) => (
                        <div key={i} className={r.errors.includes(m) ? "text-red-700" : "text-yellow-700"}>
                          {m}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button className="w-full" disabled={importable.length === 0 || committing} onClick={commit}>
            {committing ? "Importing…" : `Import ${importable.length} row(s)`}
          </Button>
        </>
      )}

      {rows === null && <EmptyState>Choose a CSV file to preview {tab === "clients" ? "clients" : "employees"} before importing.</EmptyState>}

      {(existingClients.isLoading || existingEmployees.isLoading) && <Spinner />}

      {results && (
        <Card>
          <h2 className="mb-2 font-semibold text-gray-900">Import results</h2>
          <ul className="space-y-1 text-sm">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? "text-green-700" : "text-red-700"}>
                Row {r.rowNumber} ({r.name}): {r.ok ? "imported" : `failed — ${r.message}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
