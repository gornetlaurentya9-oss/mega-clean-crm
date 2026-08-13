import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { employeesRouter } from "./employees.js";
import { clientsRouter } from "./clients.js";
import { jobsRouter } from "./jobs.js";

export const appRouter = router({
  auth: authRouter,
  employees: employeesRouter,
  clients: clientsRouter,
  jobs: jobsRouter,
});

export type AppRouter = typeof appRouter;
