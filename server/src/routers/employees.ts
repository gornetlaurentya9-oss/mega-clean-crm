import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { employees, employeeTimeOff, clients, jobEmployees, recurringPatternEmployees } from "../db/schema.js";
import { SERVICE_TYPES, EMPLOYEE_STATUSES, DAYS_OF_WEEK } from "../constants.js";

const serviceTypeEnum = z.enum(SERVICE_TYPES);

const employeeInput = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().default(""),
  qualifiedServiceTypes: z.array(serviceTypeEnum).optional().default([]),
  hourlyPayRate: z.number().min(0).optional().nullable(),
  status: z.enum(EMPLOYEE_STATUSES).optional().default("active"),
  // Fixed weekly day(s) this employee never works — see the `availability` column comment in
  // schema.ts. Stored under that column name; exposed here (and everywhere in the app) as
  // `daysOff`, checked live by conflicts.ts.
  daysOff: z.array(z.enum(DAYS_OF_WEEK)).optional().default([]),
});

function serialize(row: typeof employees.$inferSelect) {
  const { availability, ...rest } = row;
  return {
    ...rest,
    qualifiedServiceTypes: JSON.parse(row.qualifiedServiceTypes || "[]") as string[],
    daysOff: JSON.parse(availability || "[]") as (typeof DAYS_OF_WEEK)[number][],
  };
}

export const employeesRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(EMPLOYEE_STATUSES).optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.select().from(employees).orderBy(asc(sql`lower(${employees.name})`));
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
    const { daysOff, ...rest } = input;
    const [row] = await db
      .insert(employees)
      .values({
        ...rest,
        qualifiedServiceTypes: JSON.stringify(rest.qualifiedServiceTypes ?? []),
        availability: JSON.stringify(daysOff ?? []),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return serialize(row);
  }),

  update: protectedProcedure
    .input(employeeInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, daysOff, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() };
      if (rest.qualifiedServiceTypes) {
        values.qualifiedServiceTypes = JSON.stringify(rest.qualifiedServiceTypes);
      }
      if (daysOff !== undefined) {
        values.availability = JSON.stringify(daysOff);
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

  // Permanently removes an employee — distinct from setStatus("inactive"). By default blocked
  // whenever the employee has any jobs on record: job_employees.employeeId has no cascading FK,
  // so deleting an employee referenced by past jobs would leave those historical rows pointing at
  // nothing (silently losing "who did this job" from old invoices/roster records). Pass
  // force:true to delete anyway (e.g. cleaning up a test entry) — this employee's rows in
  // job_employees/recurring_pattern_employees are deleted (unassigning them from those specific
  // jobs/patterns) rather than the job/pattern rows themselves being touched, so job/invoice
  // history itself is preserved even when force-removing the employee who did the work.
  remove: protectedProcedure.input(z.object({ id: z.number(), force: z.boolean().optional() })).mutation(async ({ input }) => {
    if (!input.force) {
      const [jobRef] = await db.select().from(jobEmployees).where(eq(jobEmployees.employeeId, input.id)).limit(1);
      if (jobRef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This employee has job history on record and can't be deleted — mark them inactive instead to keep that history.",
        });
      }
    } else {
      await db.delete(jobEmployees).where(eq(jobEmployees.employeeId, input.id));
      await db.delete(recurringPatternEmployees).where(eq(recurringPatternEmployees.employeeId, input.id));
    }
    await db.delete(employeeTimeOff).where(eq(employeeTimeOff.employeeId, input.id));
    await db.update(clients).set({ defaultEmployeeId: null }).where(eq(clients.defaultEmployeeId, input.id));
    await db.delete(employees).where(eq(employees.id, input.id));
    return { success: true };
  }),
});
