# FitNow — Backend

API server for the FitNow marketplace.

## Status

Not scaffolded yet. Framework decision pending: **NestJS (Node/TypeScript)** vs **FastAPI (Python)** vs **Spring Boot (Java)**.

## Phase 1 surface

Auth, fitness profile, providers, services, classes, trainers, search, bookings, waitlist, packages, payments, reviews. Full endpoint list lives in [`../docs/PRODUCT_BRIEF.md`](../docs/PRODUCT_BRIEF.md#api-endpoints).

## Conventions (planned)

- REST + OpenAPI 3
- JWT auth (Supabase or Auth0)
- Postgres via an ORM/query builder appropriate to the chosen stack
- Stripe for payments + webhooks
- Migrations checked into `../database/migrations`
