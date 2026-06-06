# Phase 6 — Context

**Goal.** Replace browser-local persistence with a real Postgres-backed
multi-tenant API behind authentication. After this phase, deals live in a
database, are scoped to a logged-in user, and survive across devices.

## Decisions (autonomous defaults — user authorized broad scope)

| #   | Decision                  | Choice                                                                                                                    |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| C1  | ORM                       | **Drizzle** — TS-first, lighter than Prisma, zero codegen at runtime                                                      |
| C2  | Database                  | **Postgres 16**. Local dev via `docker-compose.yml`. Production target: Neon or Supabase (Phase 9).                       |
| C3  | DB driver                 | **`pg`** (node-postgres) — universally compatible. Swap to Neon HTTP driver only if we later deploy to Edge.              |
| C4  | Migrations                | **Drizzle Kit** — `drizzle.config.ts` + `drizzle-kit generate` + `drizzle-kit migrate`                                    |
| C5  | Auth library              | **NextAuth v5 (Auth.js)** — App-Router native                                                                             |
| C6  | Auth providers            | **Credentials (email + bcrypt password)** for Phase 6. Google OAuth deferred — requires user-side Google Cloud setup.    |
| C7  | Session strategy          | **JWT sessions** — stateless, no DB roundtrip per request, works on Vercel Edge later                                     |
| C8  | Schema scope              | `users`, `accounts`, `sessions`, `verification_tokens` (NextAuth standard), plus `workspaces`, `deals`, `attachments`     |
| C9  | Tenancy                   | **One default workspace per user** at signup. Team tier (multiple members per workspace) deferred to Phase 8.             |
| C10 | localStorage              | Keep as offline fallback for unauthenticated visitors. Logged-in users hit the API.                                       |
| C11 | Tests                     | **PGlite** (in-process Postgres) for the test harness — no Docker needed in CI                                            |
| C12 | API route shape           | Next.js Route Handlers under `app/api/deals/*`. RESTful: GET/POST `/api/deals`, GET/PUT/DELETE `/api/deals/[id]`           |
| C13 | Repository pattern        | Thin `lib/db/deals-repo.ts` that wraps Drizzle queries with workspace-scope checks; API routes never query Drizzle direct |
| C14 | Frontend changes          | **Defer to Phase 7** — Phase 6 ships the API; frontend continues to write to localStorage until Phase 7                   |

## Edge cases & constraints

- API routes must 401 on unauthenticated requests, 403 on cross-tenant access (asking for a deal that exists but belongs to another workspace).
- The `attachments` JSON column has a 10 MB hard cap at the DB level (avoid pathological inserts). Per-file 2 MB / per-deal 5 MB limits stay enforced at the application layer.
- Password hashing: bcrypt cost 12.
- Email uniqueness enforced at the DB level (case-insensitive: store lowercased).
- `AUTH_SECRET` required at runtime; the route returns a clear error if unset (mirrors the AI fallback pattern from Phase 4).

## Out of scope for Phase 6

- Frontend migration to the API (Phase 7)
- Email verification flow (Phase 8 — needs an email provider)
- Password reset (Phase 8)
- Rate limiting (Phase 9)
- OAuth providers (Google etc.) — needs user-side setup
- Team-tier multi-member workspaces (Phase 8)
