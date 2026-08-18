import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { recurringPatterns } from "../db/schema.js";
import { SERVICE_TYPES, FREQUENCIES, DAYS_OF_WEEK } from "../constants.js";

const patternInput = z.object({
  clientId: z.number(),
  serviceType: z.enum(SERVICE_TYPES),
  frequency: z.enum(FREQUENCIES),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  startTime: z.string(),
  durationHours: z.number().positive(),
  defaultEmployeeId: z.number().int().optional().nullable(),
  active: z.boolean().optional().default(true),
  // Only meaningful for "every-3-weeks" — see schema.ts. Optional; falls back to createdAt.
  anchorDate: z.string().optional().nullable(),
});

export const recurringPatternsRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional(), activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      let rows = await db.select().from(recurringPatterns).orderBy(desc(recurringPatterns.createdAt));
      if (input?.clientId) rows = rows.filter((r) => r.clientId === input.clientId);
      if (input?.activeOnly) rows = rows.filter((r) => r.active);
      return rows;
    }),

  create: protectedProcedure.input(patternInput).mutation(async ({ input }) => {
    const [row] = await db
      .insert(recurringPatterns)
      .values({ ...input, updatedAt: new Date().toISOString() })
      .returning();
    return row;
  }),

  update: protectedProcedure
    .input(patternInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const [row] = await db
        .update(recurringPatterns)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(recurringPatterns.id, id))
        .returning();
      return row;
    }),

  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.delete(recurringPatterns).where(eq(recurringPatterns.id, input.id));
    return { success: true };
  }),
});
