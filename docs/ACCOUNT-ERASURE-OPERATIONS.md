# Reviewed account erasure (draft; not deployed)

This workflow performs local private-account erasure only. It does not certify external providers, backups, shared restaurant records, payroll, legal retention or arbitrary free-text copies. Those require operator decisions and evidence; no retention periods are invented.

## Review without mutation

From `backend`, with an explicitly selected isolated database:

```
python scripts/account_erasure.py --request-id <verified-request-id>
```

This returns counts, blockers, required evidence categories and a plan hash. No database writes or provider calls occur. Only verified pending consumer/diner requests without unresolved active billing are eligible. Retention holds, active external/store billing, business accounts, shared relationships, structured email associations, indirect private-row dependents and unknown tables block automatic erasure. All model modules are loaded so the CLI does not omit tables imported only by web routes.

The hash includes the reviewed row set and account identity without exposing either in output. A changed row set invalidates the plan. Count-only output contains no email, reason, tokens or private content.

## Durable reviewed execution

Only after an approved erasure/retention plan and provider/backups work:

```
python scripts/account_erasure.py --request-id <id> --prepare --plan-sha <reviewed-hash> --policy-ref <approved-policy-reference>
python scripts/account_erasure.py --request-id <id> --erase-private-database --plan-sha <reviewed-hash> --evidence <evidence.json>
```

The evidence JSON must supply non-PII references for `providers`, `backups` and `retained_data`. References are operator attestations, not automated proof of external deletion. They must point to real reviewed evidence. The tool does not revoke provider credentials or cancel subscriptions.

The new `account_erasure_runs` migration durably records preparation and database-erased state. Execution locks the request/run/account, rechecks the plan and evidence, deletes only explicitly allowed private rows and local revocation records, then removes the account in one transaction. User lookup subsequently rejects existing auth tokens. Repeating a committed run returns its state instead of deleting again. It does not delete another user's rows or shared restaurant bookings to satisfy a foreign key.

`database_erased` is deliberately separate from `completed`. After verifying all remaining scopes, use the existing deletion-queue completion command with database/provider/backup/retention evidence; it checks remaining linked and structured-email records and redacts the request identity. Shared records must first be handled under a separate reviewed anonymization/retention plan. Legal holds cannot be bypassed by preparing a run earlier.

## Remaining operational gates

- Reviewed retention policy, including legal holds and shared restaurant/customer/payroll records.
- Actual deletion/revocation or justified retention in RevenueCat/Stripe, connected social/POS services, messaging, analytics/logging, object storage and backups as applicable.
- Verified support/privacy channels, queue ownership and completion review.
- Sandbox/staging erasure acceptance, migrations and production rollout approval.

No production data was deleted, no provider credential was changed and no remote provider deletion was attempted. Successful local tests are not proof that the operational deletion workflow is live.
