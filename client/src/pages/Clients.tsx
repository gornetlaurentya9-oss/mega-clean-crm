import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { SERVICE_TYPES, CLIENT_STATUSES } from "../lib/constants";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, SkeletonList, Table, TableRow } from "../components/ui";
import { ClientForm, type ClientFormValues } from "../components/ClientForm";
import { useToast } from "../components/Toast";

const statusTone = { active: "green", paused: "yellow", inactive: "gray" } as const;

export default function Clients() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const toast = useToast();
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery({
    search: search || undefined,
    status: (status || undefined) as any,
    serviceType: (serviceType || undefined) as any,
  });

  const create = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setAddOpen(false);
      toast.success("Client added");
    },
    onError: () => toast.error("Could not add client"),
  });

  function handleCreate(values: ClientFormValues) {
    create.mutate({
      ...values,
      serviceTypes: (values.serviceTypes ?? []) as any,
      defaultDurationHours: Number.isFinite(values.defaultDurationHours) ? (values.defaultDurationHours as number) : null,
      defaultEmployeeId: Number.isFinite(values.defaultEmployeeId) ? (values.defaultEmployeeId as number) : null,
      billingRate: Number.isFinite(values.billingRate) ? (values.billingRate as number) : 0,
    } as any);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-navy">Clients</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add client</Button>
      </div>

      <Card className="space-y-2">
        <Input placeholder="Search name, phone, email, address…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
            <option value="">All service types</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {clients.isLoading ? (
        <SkeletonList rows={5} />
      ) : !clients.data || clients.data.length === 0 ? (
        <EmptyState>No clients yet. Add your first client to get started.</EmptyState>
      ) : (
        <>
          <p className="text-xs font-medium text-gray-500">
            {clients.data.length} client{clients.data.length === 1 ? "" : "s"}
          </p>
          <Table>
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.data.map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} asChild>
                  <TableRow>
                    <td className="px-3 py-3 font-medium text-brand-primary">{c.name}</td>
                    <td className="px-3 py-3 text-gray-600">{c.phone}</td>
                    <td className="px-3 py-3 text-gray-600">{c.defaultFrequency}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[c.status as keyof typeof statusTone] ?? "gray"}>{c.status}</Badge>
                    </td>
                  </TableRow>
                </Link>
              ))}
            </tbody>
          </Table>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add client">
        <ClientForm onSubmit={handleCreate} submitting={create.isPending} />
      </Modal>
    </div>
  );
}
