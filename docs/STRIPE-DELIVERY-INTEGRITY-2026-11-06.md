# Stripe delivery integrity — November 6, 2026

Base: current main `84a8f071d72490abb976ff04e99b2c0f7f806e37`, after concurrent QA PR152. Local candidate only. No payment, provider setting, publication or deployment occurred.

## Fixed

- Checkout completion no longer invents active entitlement when subscription retrieval fails or lacks a status. Existing billing state remains unchanged and the webhook returns503 for provider retry.
- Processing/database exceptions now roll back and return503 rather than falsely acknowledging successful delivery. No private exception data is returned. There is no durable inbound queue, so a success response before persistence would lose the event.
- A late deletion for an older subscription cannot revoke a separately recorded replacement. Deletion must match the recorded subscription ID. Legacy paid rows lacking a subscription ID require reconciliation rather than customer-wide cancellation guesses.
- Corrected a source comment that incorrectly claimed the current snapshot checkout gate prevents all duplicate subscriptions; concurrent checkout remains a separate unresolved risk.

## Validation

Four new signed-webhook regressions fail on unchanged main and pass on this candidate. Focused billing suites:28 passed. Full backend:589 passed,12,791 warnings. Tests use local SQLite and mocked provider retrieval, not real payments or PostgreSQL. A restaurant cancellation fixture now records the actual subscription ID whose cancellation it verifies.

## Remaining gates

This is not a complete Stripe reconciliation redesign. Subscription update events still need authoritative price/customer verification, stale-event ordering safeguards and support for multiple subscriptions/providers. Checkout needs durable reservations and provider idempotency, not merely an existing-plan check. Review historical records, replay failed events through an approved process and prove provider sandbox lifecycle before live sales. Stripe retries are finite, so operational monitoring/manual reconciliation remains necessary: https://docs.stripe.com/webhooks.

Reconcile draft151 (native billing/deletion and Stripe cancellation fields) before integration. This patch deliberately leaves that draft and all original11 patch sets unchanged. The three earlier Savory patches were independently integrated with this main in a temporary worktree:56 focused backend tests plus16 subtests passed; combined frontend93 tests passed. These are separate test runs, not proof of a single fully assembled release. Production continues to require durable data preservation/cutover and canonical-domain verification.
