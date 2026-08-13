import { useParams, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Spinner } from "../components/ui";
import { ClientForm, type ClientFormValues } from "../components/ClientForm";

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = Number(id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const client = trpc.clients.byId.useQuery({ id: clientId });
  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.byId.invalidate({ id: clientId });
      utils.clients.list.invalidate();
    },
  });
  const setStatus = trpc.clients.setStatus.useMutation({
    onSuccess: () => {
      utils.clients.byId.invalidate({ id: clientId });
      utils.clients.list.invalidate();
    },
  });

  if (client.isLoading) return <Spinner />;
  if (!client.data) return <div className="p-4 text-gray-500">Client not found.</div>;
  const c = client.data;

  function handleUpdate(values: ClientFormValues) {
    update.mutate({
      id: clientId,
      ...values,
      serviceTypes: (values.serviceTypes ?? []) as any,
      defaultDurationHours: Number.isFinite(values.defaultDurationHours) ? (values.defaultDurationHours as number) : null,
      defaultEmployeeId: Number.isFinite(values.defaultEmployeeId) ? (values.defaultEmployeeId as number) : null,
      billingRate: Number.isFinite(values.billingRate) ? (values.billingRate as number) : 0,
    } as any);
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/clients")} className="text-sm text-brand-700">
        ← Back to clients
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
        <Badge tone={c.status === "active" ? "green" : c.status === "paused" ? "yellow" : "gray"}>{c.status}</Badge>
      </div>

      {c.accessNotes && (
        <Card className="border-amber-300 bg-amber-50">
          <h2 className="mb-1 flex items-center gap-1 font-semibold text-amber-900">🔑 Access notes</h2>
          <p className="whitespace-pre-wrap text-amber-900">{c.accessNotes}</p>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          {c.status !== "active" && (
            <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: clientId, status: "active" })}>
              Mark active
            </Button>
          )}
          {c.status !== "paused" && (
            <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: clientId, status: "paused" })}>
              Pause
            </Button>
          )}
          {c.status !== "inactive" && (
            <Button size="sm" variant="danger" onClick={() => setStatus.mutate({ id: clientId, status: "inactive" })}>
              Deactivate
            </Button>
          )}
        </div>
        <ClientForm
          defaultValues={{
            ...c,
            serviceTypes: c.serviceTypes,
            preferredDay: c.preferredDay ?? "",
            preferredTimeWindow: c.preferredTimeWindow ?? "",
            defaultDurationHours: c.defaultDurationHours ?? undefined,
            defaultEmployeeId: c.defaultEmployeeId ?? undefined,
            status: c.status as any,
            defaultFrequency: c.defaultFrequency as any,
            billingRateType: c.billingRateType as any,
          }}
          onSubmit={handleUpdate}
          submitting={update.isPending}
          submitLabel="Save changes"
        />
      </Card>
    </div>
  );
}
