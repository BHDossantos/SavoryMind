# Plan 6-3 — Deal CRUD API routes with workspace scoping

<plan>
  <name>REST API for deals: list, create, get, update, delete</name>
  <wave>2</wave>
  <depends_on>6-1, 6-2</depends_on>
  <files>
    <write>dealflow/app/api/deals/route.ts</write>
    <write>dealflow/app/api/deals/[id]/route.ts</write>
    <write>dealflow/lib/api/validation.ts</write>
    <write>dealflow/lib/api/__test__/validation.test.ts</write>
    <write>dealflow/app/api/deals/__test__/contract.test.ts</write>
  </files>
  <action>
    1. lib/api/validation.ts: pure functions to validate DealInput payloads —
       required string fields non-empty, numeric fields finite and ≥ 0,
       qualitative scores within 0..10. Returns either { ok: true, value }
       or { ok: false, errors }.
    2. app/api/deals/route.ts:
       - GET: requireSession → listForWorkspace(session.user.workspaceId)
              → return { deals: [...] }
       - POST: requireSession → validate → repo.create → return 201 { deal }
    3. app/api/deals/[id]/route.ts:
       - GET: requireSession → getByIdForWorkspace → 404 if not found
              (covers both not-exists and cross-tenant)
       - PUT: requireSession → validate → repo.update → 200 { deal } or 404
       - DELETE: requireSession → repo.remove → 204 or 404
    4. All routes:
       - Wrap session lookup + DB call in try/catch
       - Return application/json with consistent error shape:
         { error: "human-readable", code: "machine-readable" }
       - Never leak internal errors; log to console with request_id in dev
    5. lib/api/validation.test.ts: bounds + missing-field cases
    6. contract.test.ts: thin smoke test using node:test or vitest against
       a mocked session — verifies 401 for unauth, 400 for bad payload,
       201 for happy path, 404 for cross-tenant
  </action>
  <verify>
    - All routes return correct status codes
    - 401 on unauth (no session)
    - 400 on invalid payload with field-level errors
    - Cross-tenant lookups return 404 (no information leak about existence)
    - npm test green
  </verify>
  <done>
    - Five route handlers committed
    - Validation logic covered by unit tests
    - Contract test exercises the auth + scope invariants
  </done>
</plan>
