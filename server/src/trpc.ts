import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { isValidSession } from "./auth.js";

export function createContext({ req, res }: CreateExpressContextOptions) {
  const token = req.cookies?.session as string | undefined;
  const authed = isValidSession(token);
  return { req, res, authed };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.authed) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in." });
  }
  return next({ ctx });
});
