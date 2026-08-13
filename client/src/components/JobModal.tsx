import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { SERVICE_TYPES } from "../lib/constants";
import { Button, Input, Modal, Select } from "./ui";

// Manual status edits here are limited to the two "still upcoming" states. Completing, cancelling
// (with or without partial hours), and rescheduling all carry side effects (billing, roster
// visibility, conflict recompute) that need their own dedicated flows — see CompleteJobModal,
// CancelJobModal, and RescheduleModal.
const EDITABLE_STATUSES = ["scheduled", "confirmed"] as const;

interface JobModalProps {
  open: boolean;
  onClose: () => void;
  /** When editing, pass the existing job; when adding a one-off job, pass a default date. */
  job?: any;
  defaultDate?: string;
}

export function JobModal({ open, onClose, job, defaultDate }: JobModalProps) {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery({ status: "active" }, { enabled: open });
  const employees = trpc.employees.list.useQuery({ status: "active" }, { enabled: open });

  const [form, setForm] = useState({
    clientId: "",
    employeeId: "",
    serviceType: SERVICE_TYPES[0] as string,
    scheduledDate: defaultDate ?? "",
    startTime: "09:00",
    plannedDurationHours: 2,
    status: "scheduled" as string,
  });

  useEffect(() => {
    if (job) {
      setForm({
        clientId: String(job.clientId),
        employeeId: job.employeeId ? String(job.employeeId) : "",
        serviceType: job.serviceType,
        scheduledDate: job.scheduledDate,
        startTime: job.startTime,
        plannedDurationHours: job.plannedDurationHours,
        status: job.status,
      });
    } else {
      setForm((f) => ({ ...f, scheduledDate: defaultDate ?? f.scheduledDate }));
    }
  }, [job, defaultDate, open]);

  const create = trpc.jobs.create.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      onClose();
    },
  });
  const update = trpc.jobs.update.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      onClose();
    },
  });
  function submit() {
    const payload = {
      clientId: Number(form.clientId),
      employeeId: form.employeeId ? Number(form.employeeId) : null,
      serviceType: form.serviceType as any,
      scheduledDate: form.scheduledDate,
      startTime: form.startTime,
      plannedDurationHours: Number(form.plannedDurationHours),
      status: form.status as any,
    };
    if (job) {
      update.mutate({ id: job.id, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={job ? "Edit job" : "Add one-off job"}>
      <div className="space-y-4">
        <Select
          label="Client"
          required
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
        >
          <option value="">Select a client…</option>
          {clients.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select label="Service type" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={form.scheduledDate}
            onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
          />
          <Input
            label="Start time"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Duration (hrs)"
            type="number"
            step="0.25"
            value={form.plannedDurationHours}
            onChange={(e) => setForm({ ...form, plannedDurationHours: Number(e.target.value) })}
          />
          <Select label="Employee" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            <option value="">Unassigned</option>
            {employees.data?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </Select>
        </div>

        {job && (EDITABLE_STATUSES as readonly string[]).includes(job.status) && (
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
        {job && !(EDITABLE_STATUSES as readonly string[]).includes(job.status) && (
          <p className="text-xs text-gray-500">
            This job is {job.status.replace("-", " ")} — use the roster's Reschedule/Cancel/Complete
            actions to change that.
          </p>
        )}

        <Button className="w-full" onClick={submit} disabled={!form.clientId || !form.scheduledDate || saving}>
          {saving ? "Saving…" : job ? "Save changes" : "Add job"}
        </Button>
      </div>
    </Modal>
  );
}
