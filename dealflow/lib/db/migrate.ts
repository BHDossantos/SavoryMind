/**
 * Applies all SQL files in lib/db/migrations to the configured DATABASE_URL,
 * in lexical order, exactly once each.
 *
 * Idempotent — a `_migrations` ledger table tracks what's been applied.
 *
 * Usage:
 *   npm run db:migrate
 */
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        name text PRIMARY KEY,
        applied_at timestamp NOT NULL DEFAULT now()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM "_migrations" WHERE name = $1',
        [file],
      );
      if (rows.length > 0) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query('INSERT INTO "_migrations"(name) VALUES ($1)', [
          file,
        ]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("migrations complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
