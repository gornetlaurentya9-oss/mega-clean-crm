import { useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, EmptyState, Spinner, cx } from "../components/ui";
import { useToast } from "../components/Toast";
import {
  CLIENT_CSV_COLUMNS,
  EMPLOYEE_CSV_COLUMNS,
  RECURRING_PATTERN_CSV_COLUMNS,
  parseClientsCsv,
  parseEmployeesCsv,
  parseRecurringPatternsCsv,
  type ParsedRow,
  type ClientCsvRow,
  type EmployeeCsvRow,
  type RecurringPatternCsvRow,
} from "../lib/csvImport";

type Tab = "clients" | "employees" | "patterns";
type CommitResult = { rowNumber: number; name: string; ok: boolean; message: string };

function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function IconCopyWarning({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function Import() {
  const [tab, setTab] = useState<Tab>("clients");
  const [fileName, setFileName] = useState("");
  const [clientRows, setClientRows] = useState<ParsedRow<ClientCsvRow>[] | null>(null);
  const [employeeRows, setEmployeeRows] = useState<ParsedRow<EmployeeCsvRow>[] | null>(null);
  const [patternRows, setPatternRows] = useState<ParsedRow<RecurringPatternCsvRow>[] | null>(null);
  const [results, setResults] = useState<CommitResult[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const utils = trpc.useUtils();
  const existingClients = trpc.clients.list.useQuery();
  const existingEmployees = trpc.employees.list.useQuery();
  const createClient = trpc.clients.create.useMutation();
  const createEmployee = trpc.employees.create.useMutation();
  const createPattern = trpc.recurringPatterns.create.useMutation();

  function switchTab(t: Tab) {
    setTab(t);
    setFileName("");
    setClientRows(null);
    setEmployeeRows(null);
    setPatternRows(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function processFile(file: File) {
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
        setPatternRows(null);
      } else if (tab === "employees") {
        setEmployeeRows(
          parseEmployeesCsv(
            text,
            (existingEmployees.data ?? []).map((emp) => ({ name: emp.name, phone: emp.phone }))
          )
        );
        setClientRows(null);
        setPatternRows(null);
      } else {
        setPatternRows(
          parseRecurringPatternsCsv(
            text,
            (existingClients.data ?? []).map((c) => ({ id: c.id, name: c.name })),
            (existingEmployees.data ?? []).map((emp) => ({ id: emp.id, name: emp.name }))
          )
        );
        setClientRows(null);
        setEmployeeRows(null);
      }
    };
    reader.readAsText(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  const rows = tab === "clients" ? clientRows : tab === "employees" ? employeeRows : patternRows;
  const importable = (rows ?? []).filter((r) => r.data && !r.isDuplicate);
  const blocked = (rows ?? []).filter((r) => r.errors.length > 0);
  const duplicates = (rows ?? []).filter((r) => r.isDuplicate);

  // Recurring pattern rows have no natural "name" — the client name from the raw CSV cell is
  // used purely for display in the preview/results table.
  function rowLabel(r: ParsedRow<any>): string {
    if (tab === "patterns") return r.raw["clientname"] || "—";
    return r.raw["name"] || "—";
  }

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
    } else if (tab === "employees") {
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
    } else {
      // Committed by calling the existing recurringPatterns.create mutation once per valid row —
      // same pattern as Clients/Employees above, reusing all its server-side validation rather
      // than adding a dedicated bulk-insert endpoint.
      for (const row of patternRows ?? []) {
        if (!row.data || row.isDuplicate) continue;
        try {
          await createPattern.mutateAsync(row.data);
          out.push({ rowNumber: row.rowNumber, name: row.raw["clientname"] ?? "", ok: true, message: "Imported" });
        } catch (err: any) {
          out.push({ rowNumber: row.rowNumber, name: row.raw["clientname"] ?? "", ok: false, message: err?.message ?? "Failed" });
        }
      }
      utils.recurringPatterns.list.invalidate();
    }
    setResults(out);
    setCommitting(false);
    const succeeded = out.filter((r) => r.ok).length;
    const failed = out.length - succeeded;
    if (failed === 0) {
      toast.success(`Import complete: ${succeeded} succeeded`);
    } else {
      toast.error(`Import complete: ${succeeded} succeeded, ${failed} failed`);
    }
  }

  const columns = tab === "clients" ? CLIENT_CSV_COLUMNS : tab === "employees" ? EMPLOYEE_CSV_COLUMNS : RECURRING_PATTERN_CSV_COLUMNS;
  const loadingExisting = existingClients.isLoading || existingEmployees.isLoading;
  const tabLabels: Record<Tab, string> = { clients: "Clients", employees: "Employees", patterns: "Recurring patterns" };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Import from CSV</h1>
      <p className="text-sm text-gray-600">
        Bulk-add clients, employees, or recurring patterns from a spreadsheet. Nothing is saved until you
        review the preview below and confirm — see the README for the exact column format.
      </p>

      <div className="flex gap-1 rounded-control bg-gray-100 p-1">
        {(["clients", "employees", "patterns"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={cx(
              "min-h-[40px] flex-1 rounded-control px-2 text-sm font-medium transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
              tab === t ? "bg-white text-brand-primary shadow-soft" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium text-gray-700">
          Expected columns (first row must be a header row, in this order):
        </p>
        <p className="mb-3 break-words rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-600">
          {columns.join(", ")}
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed p-6 text-center transition-colors duration-150",
            dragOver ? "border-brand-accent bg-brand-accent/10" : "border-gray-300 bg-gray-50 hover:border-brand-accent/60 hover:bg-brand-accent/5"
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <IconUpload className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            <span className="text-brand-primary">Click to choose a file</span> or drag and drop
          </p>
          <p className="text-xs text-gray-400">.csv files only</p>
          {fileName && <p className="mt-1 text-xs font-medium text-brand-primary">Loaded: {fileName}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </Card>

      {rows && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{importable.length} will import</Badge>
            {duplicates.length > 0 && <Badge tone="yellow">{duplicates.length} duplicate (skipped)</Badge>}
            {blocked.length > 0 && <Badge tone="red">{blocked.length} has errors (skipped)</Badge>}
          </div>

          <div className="overflow-x-auto rounded-panel border border-gray-200 bg-white shadow-soft">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">{tab === "patterns" ? "Client" : "Name"}</th>
                  <th className="px-3 py-2">{tab === "patterns" ? "Day / time" : "Phone"}</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={r.errors.length > 0 ? "bg-red-50" : r.isDuplicate ? "bg-yellow-50" : ""}>
                    <td className="px-3 py-2 text-gray-500">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-medium">{rowLabel(r) !== "—" ? rowLabel(r) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {tab === "patterns"
                        ? [r.raw["dayofweek"], r.raw["starttime"]].filter(Boolean).join(" ") || <span className="text-gray-400">—</span>
                        : r.raw["phone"] || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.errors.length > 0 ? (
                        <Badge tone="red">
                          <span className="inline-flex items-center gap-1">
                            <IconAlertCircle className="h-3 w-3" /> Error
                          </span>
                        </Badge>
                      ) : r.isDuplicate ? (
                        <Badge tone="yellow">
                          <span className="inline-flex items-center gap-1">
                            <IconCopyWarning className="h-3 w-3" /> Duplicate
                          </span>
                        </Badge>
                      ) : (
                        <Badge tone="green">
                          <span className="inline-flex items-center gap-1">
                            <IconCheckCircle className="h-3 w-3" /> Ready
                          </span>
                        </Badge>
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

      {loadingExisting && <Spinner />}

      {rows === null && !loadingExisting && (
        <EmptyState>Choose a CSV file to preview {tabLabels[tab].toLowerCase()} before importing.</EmptyState>
      )}

      {results && (
        <Card
          className={cx(
            "border-2",
            results.every((r) => r.ok) ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            {results.every((r) => r.ok) ? (
              <IconCheckCircle className="h-5 w-5 text-emerald-600" />
            ) : (
              <IconAlertCircle className="h-5 w-5 text-amber-600" />
            )}
            <h2 className="font-semibold text-gray-900">
              {results.filter((r) => r.ok).length} succeeded
              {results.some((r) => !r.ok) && `, ${results.filter((r) => !r.ok).length} failed`}
            </h2>
          </div>
          <ul className="space-y-1 text-sm">
            {results.map((r, i) => (
              <li key={i} className={cx("flex items-center gap-1.5", r.ok ? "text-emerald-700" : "text-red-700")}>
                {r.ok ? <IconCheckCircle className="h-3.5 w-3.5 shrink-0" /> : <IconX className="h-3.5 w-3.5 shrink-0" />}
                Row {r.rowNumber} ({r.name}): {r.ok ? "imported" : `failed — ${r.message}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
