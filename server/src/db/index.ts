import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See server/.env.example.");
}

// Runtime app connection — points at Supabase's pooled (PgBouncer, port 6543) endpoint.
// `prepare: false` is required for PgBouncer transaction-mode pooling, which doesn't support
// prepared statements across connections.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { client };
