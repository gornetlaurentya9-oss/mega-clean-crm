import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { Button, Input, Modal, Select } from "./ui";

/**
 * Moves a job to a new date/time in place (same row/id — never a duplicate). Status resets to
 * "scheduled" since the new slot needs reconfirming, and any conflict against the new slot
 * (double-booking, time off, unqualified) is flagged immediately via the live conflicts query.
 */
export function RescheduleModal({ open, onClose, job }: { open: boolean; onClose: () => void; job?: any }) {
  const utils = trpc.useUtils();
  const employees = trpc.employees.list.useQuery({ status: "active" }, { enabled: open });
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    if (open && job) {
      setScheduledDate(job.scheduledDate);
      setStartTime(job.startTime);
      setEmployeeId(job.employeeId ? String(job.employeeId) : "");
    }
  }, [open, job]);

  const reschedule = trpc.jobs.reschedule.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.details.invalidate();
      onClose();
    },
  });

  if (!job) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Reschedule: ${job.clientName}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="New date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
          <Input label="New start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">Unassigned</option>
          {employees.data?.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </Select>
        {reschedule.error && <p className="text-sm text-red-600">{reschedule.error.message}</p>}
        <Button
          className="w-full"
          disabled={!scheduledDate || !startTime || reschedule.isPending}
          onClick={() =>
            reschedule.mutate({
              id: job.id,
              scheduledDate,
              startTime,
              employeeId: employeeId ? Number(employeeId) : null,
            })
          }
        >
          {reschedule.isPending ? "Saving…" : "Confirm reschedule"}
        </Button>
      </div>
    </Modal>
  );
}
