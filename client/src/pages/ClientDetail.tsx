import { useParams, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, SkeletonList } from "../components/ui";
import { ClientForm, type ClientFormValues } from "../components/ClientForm";
import { RecurringPatterns } from "../components/RecurringPatterns";
import { useToast } from "../components/Toast";

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = Number(id);
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const client = trpc.clients.byId.useQuery({ id: clientId });
  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.byId.invalidate({ id: clientId });
      utils.clients.list.invalidate();
      toast.success("Client updated");
    },
    onError: () => toast.error("Could not save client"),
  });
  const setStatus = trpc.clients.setStatus.useMutation({
    onSuccess: (_data, variables) => {
      utils.clients.byId.invalidate({ id: clientId });
      utils.clients.list.invalidate();
      toast.success(`Client marked ${variables.status}`);
    },
    onError: () => toast.error("Could not update client status"),
  });

  if (client.isLoading) return <SkeletonList rows={4} />;
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
      <button onClick={() => navigate("/clients")} className="text-sm font-medium text-brand-primary hover:underline">
        ← Back to clients
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-navy">{c.name}</h1>
        <Badge tone={c.status === "active" ? "green" : c.status === "paused" ? "yellow" : "gray"}>{c.status}</Badge>
      </div>

      {c.accessNotes && (
        <Card className="border-2 border-brand-accent/50 bg-gradient-to-br from-brand-accent/10 to-white shadow-soft-lg">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-brand-navy">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white">🔑</span>
            Access notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-brand-navy">{c.accessNotes}</p>
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

      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">Recurring cleaning patterns</h2>
        <RecurringPatterns clientId={clientId} />
      </Card>
    </div>
  );
}
