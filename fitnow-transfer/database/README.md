# FitNow — Database

PostgreSQL 16. Schema and migrations live here.

## Layout

```
init/        SQL files auto-run on first container boot (extensions, roles)
migrations/  Versioned schema migrations (tool TBD: Alembic / Prisma / Flyway)
seeds/       Sample data for local dev (Rome providers, classes, trainers)
```

## Tables (Phase 1)

`users`, `fitness_profiles`, `providers`, `amenities`, `provider_amenities`,
`service_categories`, `services`, `class_schedules`, `trainers`,
`trainer_availability`, `bookings`, `payments`, `reviews`.

Phase 2+: `workout_plans`, `workout_days`, `exercises`, `workout_exercises`,
`meal_plans`, `meals`, `progress`, `packages`, `waitlist`.

Full field list in [`../docs/PRODUCT_BRIEF.md`](../docs/PRODUCT_BRIEF.md#data-model).
