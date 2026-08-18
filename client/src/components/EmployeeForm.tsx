import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { SERVICE_TYPES, EMPLOYEE_STATUSES, DAYS_OF_WEEK, DAY_LABELS } from "../lib/constants";
import { Button, Card, Checkbox, Input, Select, cx } from "./ui";

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
  // Fixed weekly day(s) this employee never works — a permanent recurring rule, checked live by
  // conflict detection. Not one-off leave (that's the separate time-off list on the detail page).
  daysOff: z.array(z.enum(DAYS_OF_WEEK)).optional(),
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
  const { register, handleSubmit, control } = useForm<EmployeeFormValues>({
    defaultValues: { qualifiedServiceTypes: [], status: "active", daysOff: [], ...defaultValues },
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

      <FormSection title="Days off">
        <p className="text-xs text-gray-500">
          Fixed weekly day(s) this employee never works — a permanent rule, not one-off leave. Conflict
          detection will flag any job scheduled on one of these days.
        </p>
        <Controller
          control={control}
          name="daysOff"
          render={({ field }) => {
            const selected = field.value ?? [];
            function toggle(day: (typeof DAYS_OF_WEEK)[number]) {
              field.onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]);
            }
            return (
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const active = selected.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggle(d)}
                      className={cx(
                        "min-h-[40px] rounded-control border px-3 text-sm font-medium transition-colors duration-150",
                        active
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-brand-accent hover:bg-brand-accent/10"
                      )}
                    >
                      {DAY_LABELS[d].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            );
          }}
        />
      </FormSection>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
