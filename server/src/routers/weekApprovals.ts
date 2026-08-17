import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc.js";
import { db } from "../db/index.js";
import { weekApprovals } from "../db/schema.js";

// A purely owner-facing "I've reviewed this week and I'm happy to run it" marker, entirely
// independent of any individual job's status/clientResponseStatus — see schema.ts. One row per
// week (keyed by weekStart, the Monday), upserted on approve, deleted on unapprove.
export const weekApprovalsRouter = router({
  get: protectedProcedure.input(z.object({ weekStart: z.string() })).query(async ({ input }) => {
    const rows = await db.select().from(weekApprovals).where(eq(weekApprovals.weekStart, input.weekStart));
    return rows[0] ?? null;
  }),

  approve: protectedProcedure.input(z.object({ weekStart: z.string() })).mutation(async ({ input }) => {
    const approvedAt = new Date().toISOString();
    const [row] = await db
      .insert(weekApprovals)
      .values({ weekStart: input.weekStart, approvedAt })
      .onConflictDoUpdate({ target: weekApprovals.weekStart, set: { approvedAt } })
      .returning();
    return row;
  }),

  unapprove: protectedProcedure.input(z.object({ weekStart: z.string() })).mutation(async ({ input }) => {
    await db.delete(weekApprovals).where(eq(weekApprovals.weekStart, input.weekStart));
    return { weekStart: input.weekStart };
  }),
});
