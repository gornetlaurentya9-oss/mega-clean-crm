import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { employeesRouter } from "./employees.js";
import { clientsRouter } from "./clients.js";
import { jobsRouter } from "./jobs.js";
import { recurringPatternsRouter } from "./recurringPatterns.js";

export const appRouter = router({
  auth: authRouter,
  employees: employeesRouter,
  clients: clientsRouter,
  jobs: jobsRouter,
  recurringPatterns: recurringPatternsRouter,
});

export type AppRouter = typeof appRouter;
