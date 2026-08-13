import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { checkPassword, createSessionToken, isValidSession } from "../auth.js";

const COOKIE_NAME = "session";
const isProd = process.env.NODE_ENV === "production";

export const authRouter = router({
  status: publicProcedure.query(({ ctx }) => {
    return { authed: ctx.authed };
  }),

  login: publicProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      if (!checkPassword(input.password)) {
        return { success: false as const };
      }
      const token = createSessionToken();
      ctx.res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      return { success: true as const };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME);
    return { success: true as const };
  }),
});

export { isValidSession };
