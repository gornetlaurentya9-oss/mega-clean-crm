import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Badge, Button, EmptyState, Modal, Spinner, Table } from "../components/ui";
import { EmployeeForm, type EmployeeFormValues } from "../components/EmployeeForm";

export default function Employees() {
  const [addOpen, setAddOpen] = useState(false);
  const utils = trpc.useUtils();
  const employees = trpc.employees.list.useQuery();
  const create = trpc.employees.create.useMutation({
    onSuccess: () => {
      utils.employees.list.invalidate();
      setAddOpen(false);
    },
  });

  function handleCreate(values: EmployeeFormValues) {
    create.mutate({
      ...values,
      qualifiedServiceTypes: (values.qualifiedServiceTypes ?? []) as any,
      hourlyPayRate: Number.isFinite(values.hourlyPayRate) ? (values.hourlyPayRate as number) : null,
    } as any);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add employee</Button>
      </div>

      {employees.isLoading ? (
        <Spinner />
      ) : !employees.data || employees.data.length === 0 ? (
        <EmptyState>No employees yet. Add your first staff member.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Qualified for</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.data.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/employees/${e.id}`} className="font-medium text-brand-700 hover:underline">
                    {e.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600">{e.phone}</td>
                <td className="px-3 py-2 text-gray-600">{e.qualifiedServiceTypes.length} service type(s)</td>
                <td className="px-3 py-2">
                  <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add employee">
        <EmployeeForm onSubmit={handleCreate} submitting={create.isPending} />
      </Modal>
    </div>
  );
}
