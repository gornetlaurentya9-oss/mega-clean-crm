import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit (generate/migrate) needs a direct, non-pooled connection — Supabase's pooled
// PgBouncer endpoint (DATABASE_URL) doesn't support the transaction/DDL semantics migrations
// need. Prefer DIRECT_URL; fall back to DATABASE_URL so `drizzle-kit generate` (which only
// reads the schema file, not a live DB) still works with a single env var configured.
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString || "postgresql://placeholder:placeholder@localhost:5432/postgres",
  },
});
