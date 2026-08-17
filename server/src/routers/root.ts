import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { employeesRouter } from "./employees.js";
import { clientsRouter } from "./clients.js";
import { jobsRouter } from "./jobs.js";
import { recurringPatternsRouter } from "./recurringPatterns.js";
import { dashboardRouter } from "./dashboard.js";
import { weekApprovalsRouter } from "./weekApprovals.js";

export const appRouter = router({
  auth: authRouter,
  employees: employeesRouter,
  clients: clientsRouter,
  jobs: jobsRouter,
  recurringPatterns: recurringPatternsRouter,
  dashboard: dashboardRouter,
  weekApprovals: weekApprovalsRouter,
});

export type AppRouter = typeof appRouter;
