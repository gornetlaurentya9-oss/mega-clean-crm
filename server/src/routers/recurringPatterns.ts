import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { recurringPatterns, recurringPatternEmployees, employees } from "../db/schema.js";
import { SERVICE_TYPES, FREQUENCIES, DAYS_OF_WEEK } from "../constants.js";

const patternInput = z.object({
  clientId: z.number(),
  serviceType: z.enum(SERVICE_TYPES),
  frequency: z.enum(FREQUENCIES),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  startTime: z.string(),
  durationHours: z.number().positive(),
  // A recurring pattern can be assigned to more than one employee (e.g. a house that always
  // gets two cleaners at once) — carries through to every job `generateWeek` creates from it.
  employeeIds: z.array(z.number().int()).optional().default([]),
  active: z.boolean().optional().default(true),
  // Only meaningful for "every-3-weeks" — see schema.ts. Optional; falls back to createdAt.
  anchorDate: z.string().optional().nullable(),
});

/** Replaces a pattern's assigned-employee set (delete then re-insert — same sequential-await
 *  style as the rest of this codebase's multi-step mutations, see jobs.ts). */
async function setPatternEmployees(patternId: number, employeeIds: number[]) {
  await db.delete(recurringPatternEmployees).where(eq(recurringPatternEmployees.patternId, patternId));
  const unique = [...new Set(employeeIds)];
  if (unique.length > 0) {
    await db.insert(recurringPatternEmployees).values(unique.map((employeeId) => ({ patternId, employeeId })));
  }
}

export const recurringPatternsRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      let rows = await db.select().from(recurringPatterns).orderBy(desc(recurringPatterns.createdAt));
      if (input?.clientId) rows = rows.filter((r) => r.clientId === input.clientId);
      if (input?.activeOnly) rows = rows.filter((r) => r.active);
      if (rows.length === 0) return [];

      const patternIds = rows.map((r) => r.id);
      const assignmentRows = await db
        .select({ patternId: recurringPatternEmployees.patternId, employee: employees })
        .from(recurringPatternEmployees)
        .leftJoin(employees, eq(recurringPatternEmployees.employeeId, employees.id))
        .where(inArray(recurringPatternEmployees.patternId, patternIds));

      const byPattern = new Map<number, { id: number; name: string }[]>();
      for (const a of assignmentRows) {
        if (!a.employee) continue;
        byPattern.set(a.patternId, [...(byPattern.get(a.patternId) ?? []), { id: a.employee.id, name: a.employee.name }]);
      }

      return rows.map((r) => {
        const assigned = (byPattern.get(r.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
        return { ...r, employeeIds: assigned.map((e) => e.id), employeeNames: assigned.map((e) => e.name) };
      });
    }),

  create: protectedProcedure.input(patternInput).mutation(async ({ input }) => {
    const { employeeIds, ...rest } = input;
    const [row] = await db
      .insert(recurringPatterns)
      .values({ ...rest, updatedAt: new Date().toISOString() })
      .returning();
    if (employeeIds.length > 0) {
      await db.insert(recurringPatternEmployees).values(employeeIds.map((employeeId) => ({ patternId: row.id, employeeId })));
    }
    return row;
  }),

  update: protectedProcedure
    .input(patternInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, employeeIds, ...rest } = input;
      const [row] = await db
        .update(recurringPatterns)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(recurringPatterns.id, id))
        .returning();
      if (employeeIds !== undefined) {
        await setPatternEmployees(id, employeeIds);
      }
      return row;
    }),

  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    // recurring_pattern_employees rows for this pattern cascade-delete automatically (see schema.ts).
    await db.delete(recurringPatterns).where(eq(recurringPatterns.id, input.id));
    return { success: true };
  }),
});
