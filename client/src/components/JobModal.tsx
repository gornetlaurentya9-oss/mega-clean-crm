import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { SERVICE_TYPES } from "../lib/constants";
import { Button, Input, Modal, Select } from "./ui";
import { SearchSelect } from "./SearchSelect";
import { useToast } from "./Toast";

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
  const toast = useToast();
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
      toast.success("Job added");
      onClose();
    },
    onError: () => toast.error("Could not add job"),
  });
  const update = trpc.jobs.update.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      toast.success("Job updated");
      onClose();
    },
    onError: () => toast.error("Could not update job"),
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
        <SearchSelect
          label="Client"
          required
          placeholder="Type to search clients…"
          value={form.clientId}
          onChange={(v) => setForm({ ...form, clientId: v })}
          options={(clients.data ?? []).map((c) => ({ value: String(c.id), label: c.name, sublabel: c.phone }))}
        />

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
          <SearchSelect
            label="Employee"
            placeholder="Unassigned"
            value={form.employeeId}
            onChange={(v) => setForm({ ...form, employeeId: v })}
            options={(employees.data ?? []).map((emp) => ({ value: String(emp.id), label: emp.name }))}
          />
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
