# Store readiness follow-up — 2026-11-02

This branch is a draft for review, not release authorization. Do not merge or push to main as part of this audit: main workflows can deploy and build mobile releases.

## Fixed in this branch

- All mobile account areas (consumer, diner, restaurant More, staff portal) expose a confirmed account-deletion request. The UI distinguishes a request from completed deletion and warns that subscriptions are not cancelled.
- Deletion returns 503 when delivery to the privacy inbox fails, rather than falsely acknowledging a lost request. Confirmation-email failure does not invalidate a successfully delivered admin request. User-controlled email HTML is escaped.
- Mobile consumer/restaurant membership pages show existing server membership status without Stripe checkout/portal links. Physical food ordering is unchanged. This intentionally suspends mobile digital upsells pending a verified store-billing path; the owner must review this product tradeoff before release. No claim is made that this alone establishes store compliance.

## Still required before release

- Implement and operate verified deletion, including associated data, backups/retention exceptions, third-party data and subscription guidance. The current public endpoint sends mail; it is not an authenticated automatic erasure job or durable deletion queue. Verify privacy inbox ownership, delivery, ownership verification and completion SLA. No real deletion request or email was sent during testing.
- Decide supported storefronts and applicable billing exceptions; otherwise implement StoreKit/Play Billing, product setup, server verification, renewals/refunds and restore. Existing paid users need a reviewed cancellation-only management route. Do not restore unrestricted portal links as a shortcut.
- Diagnose `api.savorymind.net` with authorized DNS/hosting access. Repository defaults and Render migration docs consistently point at this hostname; changing the mobile URL speculatively would hide the infrastructure problem. Local DNS checks failed for BOTH api.savorymind.net and savorymind.net, and a public DNS-over-HTTPS request was blocked by this environment's proxy, so those local results cannot establish the live DNS failure's cause. No Vercel access was attempted, and the previous denial remains respected.
- PR #150 remains an open draft, with successful CI and Mobile CI for head 0e750088d4f936cec72045aed944a775a8d9e6b5. It repairs monitor alerting, not the API service. No monitor was dispatched.
- Signed device builds, store accounts, privacy/data safety declarations, review credentials and actual submission remain unverified.

## Validation

- `python -m pytest -q tests/test_account_deletion.py`: 3 passed, using local SQLite and mocked email delivery.
- `npm test -- --runInBand`: 20 suites / 105 tests passed; includes confirmation-before-submission, failed delivery, serialized API payload and both membership screens.
- `git diff --check` passed.

Policy references checked: https://developer.apple.com/app-store/review/guidelines/ and https://support.google.com/googleplay/android-developer/answer/10281818 . Exceptions vary by storefront/program; no entitlement or eligibility is assumed.

## Review follow-up

Removed unverified deletion deadlines from mobile, API acknowledgments, email templates and the web deletion-request page. Acknowledgments now explicitly distinguish requests from completed erasure. The web success state no longer claims that the separate confirmation email was delivered.

Both mobile membership pages provide cancellation guidance and a user-initiated email composer to the already published hello@savorymind.net address, with a visible manual-address fallback when opening mail fails. There is no checkout/portal link, automatic send, promised response time or cancellation-success claim. Mailbox ownership and staffing remain unverified release gates. This help path is not a replacement for an implemented cancellation-only management flow.
