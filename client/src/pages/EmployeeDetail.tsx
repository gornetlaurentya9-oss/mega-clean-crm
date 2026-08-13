import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Input, SkeletonList } from "../components/ui";
import { EmployeeForm, type EmployeeFormValues } from "../components/EmployeeForm";
import { useToast } from "../components/Toast";

export default function EmployeeDetail() {
  const { id } = useParams();
  const employeeId = Number(id);
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const employee = trpc.employees.byId.useQuery({ id: employeeId });
  const update = trpc.employees.update.useMutation({
    onSuccess: () => {
      utils.employees.byId.invalidate({ id: employeeId });
      utils.employees.list.invalidate();
      toast.success("Employee updated");
    },
    onError: () => toast.error("Could not save employee"),
  });
  const setStatus = trpc.employees.setStatus.useMutation({
    onSuccess: (_data, variables) => {
      utils.employees.byId.invalidate({ id: employeeId });
      utils.employees.list.invalidate();
      toast.success(`Employee marked ${variables.status}`);
    },
    onError: () => toast.error("Could not update employee status"),
  });
  const addTimeOff = trpc.employees.addTimeOff.useMutation({
    onSuccess: () => {
      utils.employees.byId.invalidate({ id: employeeId });
      toast.success("Time off added");
    },
    onError: () => toast.error("Could not add time off"),
  });
  const removeTimeOff = trpc.employees.removeTimeOff.useMutation({
    onSuccess: () => {
      utils.employees.byId.invalidate({ id: employeeId });
      toast.success("Time off removed");
    },
    onError: () => toast.error("Could not remove time off"),
  });

  const [timeOff, setTimeOff] = useState({ startDate: "", endDate: "", reason: "" });

  if (employee.isLoading) return <SkeletonList rows={4} />;
  if (!employee.data) return <div className="p-4 text-gray-500">Employee not found.</div>;
  const e = employee.data;

  function handleUpdate(values: EmployeeFormValues) {
    update.mutate({
      id: employeeId,
      ...values,
      qualifiedServiceTypes: (values.qualifiedServiceTypes ?? []) as any,
      hourlyPayRate: Number.isFinite(values.hourlyPayRate) ? (values.hourlyPayRate as number) : null,
    } as any);
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/employees")} className="text-sm font-medium text-brand-primary hover:underline">
        ← Back to employees
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-navy">{e.name}</h1>
        <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          {e.status !== "active" && (
            <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: employeeId, status: "active" })}>
              Mark active
            </Button>
          )}
          {e.status !== "inactive" && (
            <Button size="sm" variant="danger" onClick={() => setStatus.mutate({ id: employeeId, status: "inactive" })}>
              Mark inactive
            </Button>
          )}
        </div>
        <EmployeeForm
          defaultValues={{ ...e, hourlyPayRate: e.hourlyPayRate ?? undefined, status: e.status as any }}
          onSubmit={handleUpdate}
          submitting={update.isPending}
          submitLabel="Save changes"
        />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-brand-navy">Time off</h2>
        {e.timeOff && e.timeOff.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {e.timeOff.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-control border border-brand-accent/30 bg-brand-accent/5 px-3 py-2 text-sm"
              >
                <span className="font-medium text-brand-navy">
                  {t.startDate} → {t.endDate}
                </span>
                {t.reason && <span className="text-gray-500">({t.reason})</span>}
                <button
                  onClick={() => removeTimeOff.mutate({ id: t.id })}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                  aria-label="Remove time off"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-gray-500">No time off recorded.</p>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-control bg-gray-50 p-3 sm:grid-cols-4">
          <Input type="date" value={timeOff.startDate} onChange={(e2) => setTimeOff({ ...timeOff, startDate: e2.target.value })} />
          <Input type="date" value={timeOff.endDate} onChange={(e2) => setTimeOff({ ...timeOff, endDate: e2.target.value })} />
          <Input
            placeholder="Reason"
            value={timeOff.reason}
            onChange={(e2) => setTimeOff({ ...timeOff, reason: e2.target.value })}
          />
          <Button
            variant="secondary"
            disabled={!timeOff.startDate || !timeOff.endDate}
            onClick={() => {
              addTimeOff.mutate({ employeeId, ...timeOff });
              setTimeOff({ startDate: "", endDate: "", reason: "" });
            }}
          >
            + Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
