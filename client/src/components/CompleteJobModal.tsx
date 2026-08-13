import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button, Input, Modal, Textarea } from "./ui";
import { useToast } from "./Toast";

export function CompleteJobModal({ open, onClose, job }: { open: boolean; onClose: () => void; job?: any }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const [actualHours, setActualHours] = useState<string>(job ? String(job.plannedDurationHours) : "");
  const [notes, setNotes] = useState("");

  const complete = trpc.jobs.complete.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.details.invalidate();
      toast.success(job?.clientName ? `Job for ${job.clientName} marked complete` : "Job marked complete");
      onClose();
    },
    onError: () => toast.error("Could not mark job complete"),
  });

  if (!job) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Complete: ${job.clientName}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {job.scheduledDate} · {job.startTime} · {job.serviceType}
        </p>
        <Input
          label="Actual hours"
          type="number"
          step="0.25"
          value={actualHours}
          onChange={(e) => setActualHours(e.target.value)}
          autoFocus
          required
        />
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button
          className="w-full"
          disabled={!actualHours || complete.isPending}
          onClick={() =>
            complete.mutate({ id: job.id, actualHours: Number(actualHours), completionNotes: notes })
          }
        >
          {complete.isPending ? "Saving…" : "Mark completed"}
        </Button>
      </div>
    </Modal>
  );
}
