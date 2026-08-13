import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { SERVICE_TYPES, CLIENT_STATUSES } from "../lib/constants";
import { Badge, Button, EmptyState, Input, Modal, Select, Spinner, Table } from "../components/ui";
import { ClientForm, type ClientFormValues } from "../components/ClientForm";

const statusTone = { active: "green", paused: "yellow", inactive: "gray" } as const;

export default function Clients() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [addOpen, setAddOpen] = useState(false);

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
    },
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
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add client</Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input placeholder="Search name, phone, email, address…" value={search} onChange={(e) => setSearch(e.target.value)} />
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

      {clients.isLoading ? (
        <Spinner />
      ) : !clients.data || clients.data.length === 0 ? (
        <EmptyState>No clients yet. Add your first client to get started.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Frequency</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.data.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/clients/${c.id}`} className="font-medium text-brand-700 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600">{c.phone}</td>
                <td className="px-3 py-2 text-gray-600">{c.defaultFrequency}</td>
                <td className="px-3 py-2">
                  <Badge tone={statusTone[c.status as keyof typeof statusTone] ?? "gray"}>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add client">
        <ClientForm onSubmit={handleCreate} submitting={create.isPending} />
      </Modal>
    </div>
  );
}
