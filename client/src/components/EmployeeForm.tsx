import { useForm } from "react-hook-form";
import { z } from "zod";
import { SERVICE_TYPES, EMPLOYEE_STATUSES } from "../lib/constants";
import { Button, Card, Checkbox, Input, Select } from "./ui";

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 bg-gray-50/60">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">{title}</h3>
      {children}
    </Card>
  );
}

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  qualifiedServiceTypes: z.array(z.string()).optional(),
  hourlyPayRate: z.union([z.number(), z.nan()]).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
});

export type EmployeeFormValues = z.infer<typeof schema>;

export function EmployeeForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = "Save employee",
}: {
  defaultValues?: Partial<EmployeeFormValues>;
  onSubmit: (values: EmployeeFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const { register, handleSubmit } = useForm<EmployeeFormValues>({
    defaultValues: { qualifiedServiceTypes: [], status: "active", ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormSection title="Contact">
        <Input label="Name" required autoFocus {...register("name")} />
        <Input label="Phone" {...register("phone")} />
      </FormSection>

      <FormSection title="Skills &amp; pay">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Qualified service types</legend>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {SERVICE_TYPES.map((s) => (
              <Checkbox key={s} label={s} value={s} {...register("qualifiedServiceTypes")} />
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Hourly pay rate (€)" type="number" step="0.01" {...register("hourlyPayRate", { valueAsNumber: true })} />
          <Select label="Status" {...register("status")}>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </FormSection>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
