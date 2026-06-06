# Plan 6-1 — Drizzle + Postgres schema + migrations + local Docker

<plan>
  <name>DB foundation: schema, ORM, migrations, local Postgres</name>
  <wave>1</wave>
  <depends_on>none</depends_on>
  <files>
    <write>dealflow/package.json</write>
    <write>dealflow/docker-compose.yml</write>
    <write>dealflow/drizzle.config.ts</write>
    <write>dealflow/.env.example</write>
    <write>dealflow/lib/db/schema.ts</write>
    <write>dealflow/lib/db/client.ts</write>
    <write>dealflow/lib/db/deals-repo.ts</write>
    <write>dealflow/lib/db/users-repo.ts</write>
    <write>dealflow/lib/db/migrations/0000_initial.sql</write>
    <write>dealflow/lib/db/__test__/pglite-harness.ts</write>
    <write>dealflow/lib/db/deals-repo.test.ts</write>
  </files>
  <action>
    1. Add deps: drizzle-orm, pg, bcryptjs, @auth/drizzle-adapter, next-auth@beta.
       Dev deps: drizzle-kit, @types/pg, @types/bcryptjs, @electric-sql/pglite, dotenv.
    2. docker-compose.yml: one Postgres 16 service on port 5433 with a named volume.
    3. drizzle.config.ts: schema at lib/db/schema.ts, out at lib/db/migrations,
       dialect postgresql, dbCredentials from DATABASE_URL.
    4. lib/db/schema.ts: NextAuth tables (users, accounts, sessions,
       verificationTokens) + workspaces, workspaceMembers, deals. All Drizzle
       table definitions with proper foreign keys and indexes.
    5. lib/db/client.ts: hot-reload-safe Pool singleton + drizzle() handle.
    6. lib/db/deals-repo.ts: typed query helpers — listForWorkspace,
       getByIdForWorkspace, create, update, remove, all enforcing workspaceId scope.
    7. lib/db/users-repo.ts: createUserWithDefaultWorkspace (transaction),
       findByEmail, verifyPassword.
    8. Generated SQL migration (0000_initial.sql) checked in. Provides
       reproducible bootstrap without requiring drizzle-kit at runtime.
    9. lib/db/__test__/pglite-harness.ts: spins up PGlite, runs migration SQL,
       returns drizzle handle + cleanup. Reused by all repo tests.
    10. lib/db/deals-repo.test.ts: workspace-scope enforcement test:
        deal created in workspace A is invisible to workspace B. Plus basic CRUD round-trip.
    11. Scripts: db:up (docker compose up -d), db:down, db:reset, db:generate,
        db:migrate (apply migrations to DATABASE_URL).
  </action>
  <verify>
    - `npm run db:up` brings up Postgres on 5433 (manual verify, document in summary)
    - `npm test` passes including new deals-repo.test.ts
    - Drizzle schema compiles under tsc
    - Migration SQL applied via PGlite without error
    - Workspace-scope test demonstrably fails when scope check is removed
  </verify>
  <done>
    - All scaffolding files committed
    - PGlite test harness boots and applies migrations
    - 2+ repo tests passing
  </done>
</plan>
