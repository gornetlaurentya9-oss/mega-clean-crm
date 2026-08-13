import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/routers/root";

export const trpc = createTRPCReact<AppRouter>();

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
