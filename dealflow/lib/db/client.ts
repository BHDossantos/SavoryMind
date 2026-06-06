import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __dealflow_pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __dealflow_db: NodePgDatabase<typeof schema> | undefined;
}

export type DealflowDb = NodePgDatabase<typeof schema>;

function getPool(): Pool {
  if (globalThis.__dealflow_pgPool) return globalThis.__dealflow_pgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL.",
    );
  }
  const pool = new Pool({ connectionString, max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__dealflow_pgPool = pool;
  }
  return pool;
}

export function db(): DealflowDb {
  if (globalThis.__dealflow_db) return globalThis.__dealflow_db;
  const handle = drizzle(getPool(), { schema });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__dealflow_db = handle;
  }
  return handle;
}
