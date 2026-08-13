import { useState } from "react";
import { trpc } from "../lib/trpc";
import { SERVICE_TYPES, FREQUENCIES, DAYS_OF_WEEK, DAY_LABELS } from "../lib/constants";
import { Button, Select, Input, EmptyState } from "./ui";

export function RecurringPatterns({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const patterns = trpc.recurringPatterns.list.useQuery({ clientId });
  const employees = trpc.employees.list.useQuery({ status: "active" });
  const create = trpc.recurringPatterns.create.useMutation({
    onSuccess: () => utils.recurringPatterns.list.invalidate({ clientId }),
  });
  const update = trpc.recurringPatterns.update.useMutation({
    onSuccess: () => utils.recurringPatterns.list.invalidate({ clientId }),
  });
  const remove = trpc.recurringPatterns.remove.useMutation({
    onSuccess: () => utils.recurringPatterns.list.invalidate({ clientId }),
  });

  const [form, setForm] = useState({
    serviceType: SERVICE_TYPES[0] as string,
    frequency: "weekly" as string,
    dayOfWeek: "monday" as string,
    startTime: "09:00",
    durationHours: 2,
    defaultEmployeeId: "" as string,
  });

  function submit() {
    create.mutate({
      clientId,
      serviceType: form.serviceType as any,
      frequency: form.frequency as any,
      dayOfWeek: form.dayOfWeek as any,
      startTime: form.startTime,
      durationHours: Number(form.durationHours),
      defaultEmployeeId: form.defaultEmployeeId ? Number(form.defaultEmployeeId) : null,
    });
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
                {!p.active && <span className="ml-2 text-gray-400">(inactive)</span>}
              </div>
              <div className="flex gap-2">
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
        <Select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
          {DAYS_OF_WEEK.map((d) => (
            <option key={d} value={d}>
              {DAY_LABELS[d]}
            </option>
          ))}
        </Select>
        <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <Input
          type="number"
          step="0.25"
          placeholder="Hours"
          value={form.durationHours}
          onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}
        />
        <Select value={form.defaultEmployeeId} onChange={(e) => setForm({ ...form, defaultEmployeeId: e.target.value })}>
          <option value="">No default employee</option>
          {employees.data?.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </Select>
        <Button className="col-span-2 sm:col-span-3" variant="secondary" onClick={submit} disabled={create.isPending}>
          + Add pattern
        </Button>
      </div>
    </div>
  );
}
