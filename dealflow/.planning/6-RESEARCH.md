# Phase 6 — Research

## Drizzle in a Next.js 14 App Router project

- Packages: `drizzle-orm`, `drizzle-kit` (dev), `pg`, `@types/pg` (dev).
- `drizzle.config.ts` at `dealflow/drizzle.config.ts`. Schema path
  `lib/db/schema.ts`. Migrations to `lib/db/migrations/`.
- Connection pool: a single `Pool` from `pg` reused across requests via a
  module-level singleton (Next.js dev hot-reload safe with `globalThis`
  guard).
- Drizzle's `node-postgres` driver: `import { drizzle } from "drizzle-orm/node-postgres"`.
- Migrations apply at startup OR via `npm run db:migrate`. We expose
  the explicit script; production uses release-time migration.

## NextAuth v5 (Auth.js) in App Router

- Package: `next-auth@beta` (v5 stable enough as of mid-2026).
- Files needed:
  - `dealflow/auth.ts` — central `NextAuth({...})` config exporting
    `handlers`, `auth`, `signIn`, `signOut`.
  - `dealflow/app/api/auth/[...nextauth]/route.ts` — re-exports
    `handlers.GET / handlers.POST`.
  - `dealflow/middleware.ts` — protects `/deals/*` and `/api/deals/*`,
    redirects unauthenticated to `/login`.
- Drizzle adapter: `@auth/drizzle-adapter`. Needs the standard NextAuth
  schema (users, accounts, sessions, verificationTokens) — we extend it
  with our own tables.
- Credentials provider — supplied with custom `authorize(credentials)`
  that runs bcrypt compare against `users.hashedPassword`.
- Signup is custom (NextAuth doesn't ship a signup endpoint):
  `app/api/auth/signup/route.ts` validates → hashes → inserts user +
  default workspace → calls `signIn`.

## Schema sketch

```ts
// NextAuth standard
users(id pk, name, email unique, emailVerified, image, hashedPassword)
accounts(...)       // OAuth — empty for Phase 6
sessions(...)       // unused under JWT strategy but adapter expects table
verificationTokens(...)

// DealFlow
workspaces(id pk, name, ownerId fk→users, createdAt)
workspaceMembers(workspaceId fk, userId fk, role, primaryKey(workspaceId, userId))
deals(
  id pk,
  workspaceId fk→workspaces,
  createdById fk→users,
  // all DealInput fields:
  name, businessType, location, notes, revenue, rent, laborCost, cogs,
  utilities, otherExpenses, ownerSalary, askingPrice,
  locationQuality, growthPotential, ownerDependency, seasonality,
  // pipeline + AI
  status, priority,
  attachments jsonb,            -- []Attachment
  aiNarrative jsonb,            -- AINarrative | null
  createdAt, updatedAt
)
```

`workspaceMembers` exists from day one even though we only insert the
owner — that way Phase 8's team tier is a pure data change, no schema
migration.

## API contract

| Method | Path                | Behaviour                                              |
| ------ | ------------------- | ------------------------------------------------------ |
| GET    | /api/deals          | List deals in caller's workspace; sort by createdAt DESC |
| POST   | /api/deals          | Create a deal in caller's default workspace            |
| GET    | /api/deals/[id]     | Fetch one deal; 404 if not in caller's workspace       |
| PUT    | /api/deals/[id]     | Replace fields; 403 if not in caller's workspace       |
| DELETE | /api/deals/[id]     | Remove; 403 if cross-tenant                            |

Each handler:
1. `const session = await auth();` — 401 if null.
2. Resolve caller's `workspaceId` (their default workspace).
3. Pass `workspaceId` to the repo function which enforces scope.

## Testing strategy

- `vitest` already in place from Phase 5.
- Add `@electric-sql/pglite` — in-process Postgres, no Docker.
- `lib/db/__test__/migrate.ts` helper boots a fresh PGlite instance and
  applies all migrations. Each test gets a clean DB.
- Test surface:
  - Schema migrations apply cleanly.
  - Repo functions enforce workspace scope (deal-from-other-workspace
    returns null).
  - Signup → creates user + default workspace in one transaction.
  - Auth `authorize()` returns null for bad password, user object for good.

## Risks / known issues

- **PGlite vs node-postgres dialect.** PGlite supports the same wire
  protocol but a subset of extensions. We use only standard SQL, no PG
  extensions, so this is fine.
- **NextAuth v5 + Drizzle adapter version churn.** We pin `next-auth@5.0.x`
  and `@auth/drizzle-adapter` to versions known to work together. Lockfile
  protects us.
- **Hot-reload Pool leakage in dev.** Mitigated by a `globalThis.__pgPool`
  singleton guard.
- **Env vars required at runtime:** `DATABASE_URL`, `AUTH_SECRET`. Both
  surfaced with clear startup errors in dev.
