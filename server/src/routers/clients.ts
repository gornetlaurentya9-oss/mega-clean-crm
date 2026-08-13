import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { clients } from "../db/schema.js";
import { SERVICE_TYPES, FREQUENCIES, CLIENT_STATUSES, BILLING_RATE_TYPES } from "../constants.js";

const serviceTypeEnum = z.enum(SERVICE_TYPES);

const clientInput = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional().default(""),
  email: z.string().optional().default(""),
  serviceTypes: z.array(serviceTypeEnum).optional().default([]),
  defaultFrequency: z.enum(FREQUENCIES).optional().default("weekly"),
  preferredDay: z.string().optional().nullable(),
  preferredTimeWindow: z.string().optional().nullable(),
  defaultDurationHours: z.number().positive().optional().nullable(),
  defaultEmployeeId: z.number().int().optional().nullable(),
  accessNotes: z.string().optional().default(""),
  billingRate: z.number().min(0).optional().default(0),
  billingRateType: z.enum(BILLING_RATE_TYPES).optional().default("per-visit"),
  status: z.enum(CLIENT_STATUSES).optional().default("active"),
  notes: z.string().optional().default(""),
});

function serialize(row: typeof clients.$inferSelect) {
  return {
    ...row,
    serviceTypes: JSON.parse(row.serviceTypes || "[]") as string[],
  };
}

export const clientsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          status: z.enum(CLIENT_STATUSES).optional(),
          serviceType: serviceTypeEnum.optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(clients)
        .orderBy(desc(clients.createdAt));
      let result = rows.map(serialize);
      if (input?.status) {
        result = result.filter((c) => c.status === input.status);
      }
      if (input?.serviceType) {
        result = result.filter((c) => c.serviceTypes.includes(input.serviceType!));
      }
      if (input?.search) {
        const q = input.search.toLowerCase();
        result = result.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q)
        );
      }
      return result;
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const rows = await db.select().from(clients).where(eq(clients.id, input.id));
    const row = rows[0];
    if (!row) return null;
    return serialize(row);
  }),

  create: protectedProcedure.input(clientInput).mutation(async ({ input }) => {
    const [row] = await db
      .insert(clients)
      .values({
        ...input,
        serviceTypes: JSON.stringify(input.serviceTypes ?? []),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return serialize(row);
  }),

  update: protectedProcedure
    .input(clientInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() };
      if (rest.serviceTypes) {
        values.serviceTypes = JSON.stringify(rest.serviceTypes);
      }
      const [row] = await db.update(clients).set(values).where(eq(clients.id, id)).returning();
      return serialize(row);
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(CLIENT_STATUSES) }))
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(clients)
        .set({ status: input.status, updatedAt: new Date().toISOString() })
        .where(eq(clients.id, input.id))
        .returning();
      return serialize(row);
    }),
});
