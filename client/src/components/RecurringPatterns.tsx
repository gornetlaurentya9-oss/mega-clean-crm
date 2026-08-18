import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { SERVICE_TYPES, FREQUENCIES, DAYS_OF_WEEK, DAY_LABELS } from "../lib/constants";
import { Button, Select, Input, Modal, EmptyState, cx } from "./ui";
import { SearchMultiSelect } from "./SearchMultiSelect";
import { useToast } from "./Toast";

export function RecurringPatterns({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const patterns = trpc.recurringPatterns.list.useQuery({ clientId });
  const employees = trpc.employees.list.useQuery({ status: "active" });
  const create = trpc.recurringPatterns.create.useMutation();
  const update = trpc.recurringPatterns.update.useMutation({
    onSuccess: () => utils.recurringPatterns.list.invalidate({ clientId }),
  });
  const remove = trpc.recurringPatterns.remove.useMutation({
    onSuccess: () => utils.recurringPatterns.list.invalidate({ clientId }),
  });

  const [editPattern, setEditPattern] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    serviceType: SERVICE_TYPES[0] as string,
    frequency: "weekly" as string,
    // Multiple days selected at once creates one pattern per day (e.g. a client cleaned
    // Mon/Wed/Fri) instead of making the owner add them one at a time.
    days: ["monday"] as string[],
    startTime: "09:00",
    durationHours: 2,
    // Shared across every pattern created from a multi-day selection — e.g. Mon/Wed/Fri +
    // Alice/Bob creates 3 patterns, each assigned to both Alice and Bob.
    employeeIds: [] as string[],
    anchorDate: "" as string,
  });

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
    }));
  }

  async function submit() {
    if (form.days.length === 0) {
      toast.error("Pick at least one day");
      return;
    }
    setSubmitting(true);
    try {
      for (const day of form.days) {
        await create.mutateAsync({
          clientId,
          serviceType: form.serviceType as any,
          frequency: form.frequency as any,
          dayOfWeek: day as any,
          startTime: form.startTime,
          durationHours: Number(form.durationHours),
          employeeIds: form.employeeIds.map(Number),
          anchorDate: form.frequency === "every-3-weeks" && form.anchorDate ? form.anchorDate : null,
        });
      }
      utils.recurringPatterns.list.invalidate({ clientId });
      toast.success(
        form.days.length === 1 ? "Recurring pattern added" : `${form.days.length} recurring patterns added (one per day)`
      );
    } catch {
      toast.error("Could not add one or more patterns");
      utils.recurringPatterns.list.invalidate({ clientId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {patterns.data && patterns.data.length > 0 ? (
        <ul className="space-y-2">
          {patterns.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
              <div className="text-sm">
                <span className="font-medium">{DAY_LABELS[p.dayOfWeek]}</span> {p.startTime} · {p.durationHours}h ·{" "}
                {p.serviceType} · {p.frequency}
                {p.frequency === "every-3-weeks" && (
                  <span className="text-gray-400"> (from {p.anchorDate ?? p.createdAt.slice(0, 10)})</span>
                )}
                {!p.active && <span className="ml-2 text-gray-400">(inactive)</span>}
                <div className="text-xs text-gray-500">
                  {p.employeeNames && p.employeeNames.length > 0 ? p.employeeNames.join(", ") : "Unassigned"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditPattern(p)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => update.mutate({ id: p.id, active: !p.active })}
                >
                  {p.active ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove.mutate({ id: p.id })}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No recurring patterns yet.</EmptyState>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
        <Select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
        <div className="col-span-2 sm:col-span-3">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Day(s) <span className="text-red-600">*</span>
            {form.days.length > 1 && (
              <span className="ml-1 font-normal text-gray-400">— one pattern will be added per day selected</span>
            )}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK.map((d) => {
              const active = form.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cx(
                    "min-h-[40px] rounded-control border px-3 text-sm font-medium transition-colors duration-150",
                    active
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-brand-accent hover:bg-brand-accent/10"
                  )}
                >
                  {DAY_LABELS[d].slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
        <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <Input
          type="number"
          step="0.25"
          placeholder="Hours"
          value={form.durationHours}
          onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}
        />
        <div className="col-span-2 sm:col-span-3">
          <SearchMultiSelect
            placeholder="No employees assigned"
            values={form.employeeIds}
            onChange={(v) => setForm({ ...form, employeeIds: v })}
            options={(employees.data ?? []).map((emp) => ({ value: String(emp.id), label: emp.name }))}
          />
        </div>
        {form.frequency === "every-3-weeks" && (
          <Input
            type="date"
            title="First date of the 3-week cycle (defaults to today if left blank)"
            value={form.anchorDate}
            onChange={(e) => setForm({ ...form, anchorDate: e.target.value })}
          />
        )}
        <Button className="col-span-2 sm:col-span-3" variant="secondary" onClick={submit} disabled={submitting}>
          {submitting
            ? "Adding…"
            : form.days.length > 1
              ? `+ Add ${form.days.length} patterns`
              : "+ Add pattern"}
        </Button>
      </div>

      <EditPatternModal
        pattern={editPattern}
        open={!!editPattern}
        onClose={() => setEditPattern(null)}
        employees={employees.data ?? []}
        clientId={clientId}
      />
    </div>
  );
}

/**
 * Edits a single existing recurring pattern row — unlike the "add pattern" form above, a pattern
 * being edited is the single-day/single-employee-set record it actually is, so this never
 * re-expands into multiple rows even though it shares the add form's field set (service type,
 * frequency, one day, time, duration, employees). Same Modal pattern as JobModal/other edit
 * flows in this app.
 */
function EditPatternModal({
  pattern,
  open,
  onClose,
  employees,
  clientId,
}: {
  pattern: any;
  open: boolean;
  onClose: () => void;
  employees: any[];
  clientId: number;
}) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const update = trpc.recurringPatterns.update.useMutation({
    onSuccess: () => {
      utils.recurringPatterns.list.invalidate({ clientId });
      toast.success("Pattern updated");
      onClose();
    },
    onError: () => toast.error("Could not update pattern"),
  });

  const [form, setForm] = useState({
    serviceType: SERVICE_TYPES[0] as string,
    frequency: "weekly" as string,
    dayOfWeek: "monday" as string,
    startTime: "09:00",
    durationHours: 2,
    employeeIds: [] as string[],
    anchorDate: "" as string,
    active: true,
  });

  useEffect(() => {
    if (pattern) {
      setForm({
        serviceType: pattern.serviceType,
        frequency: pattern.frequency,
        dayOfWeek: pattern.dayOfWeek,
        startTime: pattern.startTime,
        durationHours: pattern.durationHours,
        employeeIds: (pattern.employeeIds ?? []).map((id: number) => String(id)),
        anchorDate: pattern.anchorDate ?? "",
        active: pattern.active,
      });
    }
  }, [pattern, open]);

  if (!pattern) return null;

  function submit() {
    update.mutate({
      id: pattern.id,
      serviceType: form.serviceType as any,
      frequency: form.frequency as any,
      dayOfWeek: form.dayOfWeek as any,
      startTime: form.startTime,
      durationHours: Number(form.durationHours),
      employeeIds: form.employeeIds.map(Number),
      anchorDate: form.frequency === "every-3-weeks" && form.anchorDate ? form.anchorDate : null,
      active: form.active,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit recurring pattern">
      <div className="space-y-4">
        <Select label="Service type" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <Select label="Day of week" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start time" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <Input
            label="Duration (hrs)"
            type="number"
            step="0.25"
            value={form.durationHours}
            onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}
          />
        </div>
        <SearchMultiSelect
          label="Employees"
          placeholder="No employees assigned"
          values={form.employeeIds}
          onChange={(v) => setForm({ ...form, employeeIds: v })}
          options={employees.map((emp) => ({ value: String(emp.id), label: emp.name }))}
        />
        {form.frequency === "every-3-weeks" && (
          <Input
            label="Anchor date"
            type="date"
            hint="First date of the 3-week cycle (defaults to when the pattern was created if left blank)"
            value={form.anchorDate}
            onChange={(e) => setForm({ ...form, anchorDate: e.target.value })}
          />
        )}
        <Button className="w-full" onClick={submit} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}
