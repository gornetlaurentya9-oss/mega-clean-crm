import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { employees, employeeTimeOff } from "../db/schema.js";
import { SERVICE_TYPES, EMPLOYEE_STATUSES, DAYS_OF_WEEK } from "../constants.js";

const serviceTypeEnum = z.enum(SERVICE_TYPES);

const availabilitySlot = z.object({
  day: z.enum(DAYS_OF_WEEK),
  startTime: z.string(), // HH:mm
  endTime: z.string(), // HH:mm
});

const employeeInput = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().default(""),
  qualifiedServiceTypes: z.array(serviceTypeEnum).optional().default([]),
  hourlyPayRate: z.number().min(0).optional().nullable(),
  status: z.enum(EMPLOYEE_STATUSES).optional().default("active"),
  availability: z.array(availabilitySlot).optional().default([]),
});

function serialize(row: typeof employees.$inferSelect) {
  return {
    ...row,
    qualifiedServiceTypes: JSON.parse(row.qualifiedServiceTypes || "[]") as string[],
    availability: JSON.parse(row.availability || "[]") as z.infer<typeof availabilitySlot>[],
  };
}

export const employeesRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(EMPLOYEE_STATUSES).optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.select().from(employees).orderBy(desc(employees.createdAt));
      let result = rows.map(serialize);
      if (input?.status) result = result.filter((e) => e.status === input.status);
      return result;
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const rows = await db.select().from(employees).where(eq(employees.id, input.id));
    const row = rows[0];
    if (!row) return null;
    const timeOff = await db
      .select()
      .from(employeeTimeOff)
      .where(eq(employeeTimeOff.employeeId, input.id));
    return { ...serialize(row), timeOff };
  }),

  create: protectedProcedure.input(employeeInput).mutation(async ({ input }) => {
    const [row] = await db
      .insert(employees)
      .values({
        ...input,
        qualifiedServiceTypes: JSON.stringify(input.qualifiedServiceTypes ?? []),
        availability: JSON.stringify(input.availability ?? []),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return serialize(row);
  }),

  update: protectedProcedure
    .input(employeeInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() };
      if (rest.qualifiedServiceTypes) {
        values.qualifiedServiceTypes = JSON.stringify(rest.qualifiedServiceTypes);
      }
      if (rest.availability) {
        values.availability = JSON.stringify(rest.availability);
      }
      const [row] = await db.update(employees).set(values).where(eq(employees.id, id)).returning();
      return serialize(row);
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(EMPLOYEE_STATUSES) }))
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(employees)
        .set({ status: input.status, updatedAt: new Date().toISOString() })
        .where(eq(employees.id, input.id))
        .returning();
      return serialize(row);
    }),

  addTimeOff: protectedProcedure
    .input(
      z.object({
        employeeId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional().default(""),
      })
    )
    .mutation(async ({ input }) => {
      const [row] = await db.insert(employeeTimeOff).values(input).returning();
      return row;
    }),

  removeTimeOff: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.delete(employeeTimeOff).where(eq(employeeTimeOff.id, input.id));
    return { success: true };
  }),
});
