import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { Button, Input, Modal } from "./ui";
import { SearchSelect } from "./SearchSelect";
import { useToast } from "./Toast";

/**
 * Moves a job to a new date/time in place (same row/id — never a duplicate). Status resets to
 * "scheduled" since the new slot needs reconfirming, and any conflict against the new slot
 * (double-booking, time off, unqualified) is flagged immediately via the live conflicts query.
 */
export function RescheduleModal({ open, onClose, job }: { open: boolean; onClose: () => void; job?: any }) {
  const utils = trpc.useUtils();
  const toast = useToast();
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
      toast.success(job?.clientName ? `Job for ${job.clientName} rescheduled` : "Job rescheduled");
      onClose();
    },
    onError: () => toast.error("Could not reschedule job"),
  });

  if (!job) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Reschedule: ${job.clientName}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="New date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
          <Input label="New start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <SearchSelect
          label="Employee"
          placeholder="Unassigned"
          value={employeeId}
          onChange={setEmployeeId}
          options={(employees.data ?? []).map((emp) => ({ value: String(emp.id), label: emp.name }))}
        />
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
