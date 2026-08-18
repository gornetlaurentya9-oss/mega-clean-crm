import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SERVICE_TYPES, FREQUENCIES, CLIENT_STATUSES, BILLING_RATE_TYPES } from "../lib/constants";
import { DAY_LABELS, DAYS_OF_WEEK } from "../lib/constants";
import { Button, Card, Checkbox, Input, Select, Textarea } from "./ui";
import { SearchSelect } from "./SearchSelect";
import { trpc } from "../lib/trpc";

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 bg-gray-50/60">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">{title}</h3>
      {children}
    </Card>
  );
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
  email: z.string().optional(),
  serviceTypes: z.array(z.string()).optional(),
  defaultFrequency: z.enum(FREQUENCIES).optional(),
  preferredDay: z.string().optional(),
  preferredTimeWindow: z.string().optional(),
  defaultDurationHours: z.union([z.number(), z.nan()]).optional(),
  defaultEmployeeId: z.union([z.number(), z.nan()]).optional(),
  accessNotes: z.string().optional(),
  billingRate: z.union([z.number(), z.nan()]).optional(),
  billingRateType: z.enum(BILLING_RATE_TYPES).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  notes: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof schema>;

export function ClientForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel = "Save client",
}: {
  defaultValues?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceTypes: [],
      defaultFrequency: "weekly",
      billingRateType: "per-visit",
      status: "active",
      ...defaultValues,
    },
  });

  const employees = trpc.employees.list.useQuery({ status: "active" });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormSection title="Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" required autoFocus tabIndex={1} error={errors.name?.message} {...register("name")} />
          <Input label="Phone" required tabIndex={2} error={errors.phone?.message} {...register("phone")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" tabIndex={3} {...register("email")} />
          <Input label="Address" tabIndex={4} {...register("address")} />
        </div>
      </FormSection>

      <FormSection title="Service &amp; schedule">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Service types</legend>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {SERVICE_TYPES.map((s) => (
              <Checkbox key={s} label={s} value={s} {...register("serviceTypes")} />
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Select label="Frequency" tabIndex={5} {...register("defaultFrequency")}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <Select label="Preferred day" tabIndex={6} {...register("preferredDay")}>
            <option value="">—</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </Select>
          <Input label="Time window" placeholder="e.g. 9-11am" tabIndex={7} {...register("preferredTimeWindow")} />
          <Input
            label="Duration (hrs)"
            type="number"
            step="0.25"
            tabIndex={8}
            {...register("defaultDurationHours", { valueAsNumber: true })}
          />
        </div>

        <SearchSelect
          label="Default employee"
          placeholder="—"
          value={watch("defaultEmployeeId") ? String(watch("defaultEmployeeId")) : ""}
          onChange={(v) => setValue("defaultEmployeeId", v ? Number(v) : undefined, { shouldDirty: true })}
          options={(employees.data ?? []).map((e) => ({ value: String(e.id), label: e.name }))}
        />
      </FormSection>

      <FormSection title="Billing &amp; access notes">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input label="Billing rate (€)" type="number" step="0.01" tabIndex={10} {...register("billingRate", { valueAsNumber: true })} />
          <Select label="Rate type" tabIndex={11} {...register("billingRateType")}>
            {BILLING_RATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select label="Status" tabIndex={12} {...register("status")}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Access notes"
          hint="Key/lockbox code, alarm code, pets, parking, etc."
          tabIndex={13}
          {...register("accessNotes")}
        />
        <Textarea label="Other notes" tabIndex={14} {...register("notes")} />
      </FormSection>

      <Button type="submit" className="w-full" disabled={submitting} tabIndex={15}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
