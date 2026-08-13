import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { employeesRouter } from "./employees.js";
import { clientsRouter } from "./clients.js";

export const appRouter = router({
  auth: authRouter,
  employees: employeesRouter,
  clients: clientsRouter,
});

export type AppRouter = typeof appRouter;
