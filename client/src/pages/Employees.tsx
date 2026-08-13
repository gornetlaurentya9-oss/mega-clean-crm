import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Badge, Button, EmptyState, Modal, SkeletonList, Table, TableRow } from "../components/ui";
import { EmployeeForm, type EmployeeFormValues } from "../components/EmployeeForm";
import { useToast } from "../components/Toast";

export default function Employees() {
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();
  const utils = trpc.useUtils();
  const employees = trpc.employees.list.useQuery();
  const create = trpc.employees.create.useMutation({
    onSuccess: () => {
      utils.employees.list.invalidate();
      setAddOpen(false);
      toast.success("Employee added");
    },
    onError: () => toast.error("Could not add employee"),
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
        <h1 className="text-2xl font-bold text-brand-navy">Employees</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add employee</Button>
      </div>

      {employees.isLoading ? (
        <SkeletonList rows={5} />
      ) : !employees.data || employees.data.length === 0 ? (
        <EmptyState>No employees yet. Add your first staff member.</EmptyState>
      ) : (
        <>
          <p className="text-xs font-medium text-gray-500">
            {employees.data.length} employee{employees.data.length === 1 ? "" : "s"}
          </p>
          <Table>
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Qualified for</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.data.map((e) => (
                <Link key={e.id} href={`/employees/${e.id}`} asChild>
                  <TableRow>
                    <td className="px-3 py-3 font-medium text-brand-primary">{e.name}</td>
                    <td className="px-3 py-3 text-gray-600">{e.phone}</td>
                    <td className="px-3 py-3 text-gray-600">{e.qualifiedServiceTypes.length} service type(s)</td>
                    <td className="px-3 py-3">
                      <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
                    </td>
                  </TableRow>
                </Link>
              ))}
            </tbody>
          </Table>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add employee">
        <EmployeeForm onSubmit={handleCreate} submitting={create.isPending} />
      </Modal>
    </div>
  );
}
