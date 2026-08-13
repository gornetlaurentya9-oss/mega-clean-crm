import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { employeesRouter } from "./employees.js";

export const appRouter = router({
  auth: authRouter,
  employees: employeesRouter,
});

export type AppRouter = typeof appRouter;
