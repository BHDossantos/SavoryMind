# Phase 04 — Admin panel + provider approval

**Status:** done
**Commit:** `091ac33`
**Date:** 2026-04-30

## Goal

Allow real providers to self-signup without instantly polluting the marketplace. Admins gain a dashboard, an approval queue, a suspend lever, and audit views for bookings + users.

## Outcome

- `Provider.approval_status` (`pending` / `approved` / `suspended`) defaults to `pending` on self-signup. Seeded providers ship as `approved` (D-10).
- Public `/search/providers` and `/providers/:id` only return approved providers; suspended providers 404 publicly.
- New `/admin` router gated by `Role.admin`:
  - `GET /admin/dashboard` — KPIs: users, providers (incl. pending + suspended), bookings (today / 7d / cancellations 7d), gross booking value, deposits held
  - `GET /admin/providers` filtered by approval status
  - `POST /admin/providers/:id/approve`
  - `POST /admin/providers/:id/suspend?reason=`
  - `GET /admin/bookings` filtered by status
  - `GET /admin/users` filtered by role
- Seeded admin: `admin@slotly.app / admin123`
- Frontend: `/admin` shell with sticky tab nav, gated to admin role; dashboard with KPI tiles + a banner that links to the pending queue; providers page with inline approve/suspend (suspend prompts for a reason); bookings + users tables with filters; nav surfaces an "Admin" link for admin users.
- README documents demo logins, Stripe stub mode, and the approval gate.

## Decisions logged

- D-10 (new providers default to pending; seeded providers approved)

## Verified (9 scenarios)

Customer hits `/admin/dashboard` → 403; admin sees seeded providers as approved; new self-signup provider lands in pending; pending provider hidden from public search; approve flips to visible; suspend flips back to hidden + 404 on public profile; bookings + users tables work with filters.

## What was deferred

Provider featuring, dispute view, refund issuance from admin, audit logs of admin actions, role-scoped admin (e.g. read-only support staff).
