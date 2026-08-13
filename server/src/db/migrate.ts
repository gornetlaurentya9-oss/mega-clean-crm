import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema.js";

// Migrations need a direct (non-pooled, transaction-capable) connection — Supabase's pooled
// PgBouncer endpoint (DATABASE_URL) doesn't support the DDL/transaction semantics drizzle's
// migrator relies on. Prefer DIRECT_URL; fall back to DATABASE_URL if it isn't set (e.g. a
// plain, non-pooled Postgres instance where the two are the same).
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) is not set. See server/.env.example.");
}

const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient, { schema });

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
await migrationClient.end();
