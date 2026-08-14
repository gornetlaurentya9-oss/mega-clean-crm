import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { Button, Input, Modal, Textarea } from "./ui";
import { useToast } from "./Toast";

/**
 * Cancelling a job covers two real-world cases:
 *  - Nothing happened yet (client cancelled ahead of time, or this reverses a mistaken
 *    "completed") — no hours, nothing owed, never billed.
 *  - Real work happened before/around the cancellation (partial visit, or a completed job the
 *    client later disputed) — record the hours actually worked so the business still gets paid
 *    for the time spent; those hours flow into the monthly invoice export same as a completed job.
 */
export function CancelJobModal({ open, onClose, job }: { open: boolean; onClose: () => void; job?: any }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const [mode, setMode] = useState<"none" | "partial">("none");
  const [actualHours, setActualHours] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setMode("none");
      setActualHours(job?.actualHours ? String(job.actualHours) : "");
      setNotes("");
    }
  }, [open, job]);

  const cancel = trpc.jobs.cancel.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      utils.jobs.conflicts.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.details.invalidate();
      toast.success(job?.clientName ? `Job for ${job.clientName} cancelled` : "Job cancelled");
      onClose();
    },
    onError: () => toast.error("Could not cancel job"),
  });

  if (!job) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Cancel: ${job.clientName}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {job.scheduledDate} · {job.startTime} · {job.serviceType}
        </p>

        <div className="flex gap-2">
          <Button size="sm" variant={mode === "none" ? "primary" : "secondary"} onClick={() => setMode("none")}>
            No work done
          </Button>
          <Button size="sm" variant={mode === "partial" ? "primary" : "secondary"} onClick={() => setMode("partial")}>
            Work was done first
          </Button>
        </div>

        {mode === "none" ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            This job will be marked cancelled, dropped from the active roster view, and left out of
            the monthly invoice export — nothing is owed.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Record the hours actually worked before the cancellation. This job will still show up
              in the monthly invoice export and count toward revenue for that time.
            </p>
            <Input
              label="Actual hours worked"
              type="number"
              step="0.25"
              min="0"
              value={actualHours}
              onChange={(e) => setActualHours(e.target.value)}
              autoFocus
              required
            />
            <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        <Button
          className="w-full"
          variant="danger"
          disabled={(mode === "partial" && (!actualHours || Number(actualHours) <= 0)) || cancel.isPending}
          onClick={() =>
            cancel.mutate({
              id: job.id,
              actualHours: mode === "partial" ? Number(actualHours) : undefined,
              completionNotes: mode === "partial" ? notes : undefined,
            })
          }
        >
          {cancel.isPending ? "Cancelling…" : "Confirm cancellation"}
        </Button>
      </div>
    </Modal>
  );
}
