import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../schema";
import type { DealflowDb } from "../client";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

export interface TestDb {
  db: DealflowDb;
  pg: PGlite;
  close: () => Promise<void>;
}

/**
 * Boot a fresh in-process Postgres, apply migrations, return a Drizzle handle.
 * Use this in beforeEach/afterEach for isolation between tests.
 *
 * The drizzle/pglite cast is intentional: PGlite implements enough of the
 * node-postgres surface for our queries; we type the return as the production
 * DealflowDb so tests exercise the same query types.
 */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.waitReady;

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await pg.exec(sql);
  }

  const db = drizzle(pg, { schema }) as unknown as DealflowDb;
  return {
    db,
    pg,
    close: async () => {
      await pg.close();
    },
  };
}
