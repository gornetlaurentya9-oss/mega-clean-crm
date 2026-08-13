import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/routers/root";

export const trpc = createTRPCReact<AppRouter>();

// In production this defaults to "" (same-origin /trpc), since the Express
// server serves the built frontend itself. In dev it defaults to the local
// API server unless overridden via client/.env.
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:4000");
