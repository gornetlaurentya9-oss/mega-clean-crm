import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/root.js";
import { createContext } from "./trpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: CLIENT_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// In production, this single Express service also serves the built Vite
// frontend, so the whole app deploys as one Render Web Service. In dev the
// Vite dev server (port 5173) serves the frontend instead, so this is skipped.
if (IS_PRODUCTION) {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Mega Clean CRM API listening on http://localhost:${PORT}`);
});
