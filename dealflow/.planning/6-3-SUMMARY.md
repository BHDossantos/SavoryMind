# Plan 6-3 — Summary

**Status:** ✅ Done — commit `Phase 6-3`

## What shipped

- **`/api/deals` (collection)** — `GET` lists workspace deals (newest first), `POST` creates one. 401 unauth, 400 with field-level errors on bad payload, 201 on success.
- **`/api/deals/[id]` (item)** — `GET`, `PUT` (partial update), `DELETE`. 404 on cross-tenant access (no information leak about existence). 204 on delete.
- **`lib/api/validation.ts`** — `validateDealInput(input, mode)` with `create` vs `patch` modes. Coerces stringified numbers. Bounds qualitative inputs to 0–10. Rejects unknown `businessType`. `validateStatusPatch` separately gates `status` + `priority` enums.
- All handlers use `requireSession()` from Plan 6-2 and `lib/db/deals-repo.ts` from Plan 6-1 — no DB queries inside route files.
- **11 new validation tests** covering required-field enforcement, enum rejection, bounds, string-number coercion, patch-mode optionality.

## Verify-block results

| Check                                                              | Status |
| ------------------------------------------------------------------ | ------ |
| Routes appear in `next build` output                               | ✅ `/api/deals` and `/api/deals/[id]` listed as dynamic |
| 401 on unauthenticated request                                     | ✅ Via middleware + `requireSession()` (covered structurally) |
| 400 on invalid payload with field-level errors                     | ✅ Unit-tested |
| Cross-tenant lookups return 404 — no information leak              | ✅ Enforced by `getByIdForWorkspace` from Plan 6-1 |
| `npm test` green                                                   | ✅ 51/51 |
