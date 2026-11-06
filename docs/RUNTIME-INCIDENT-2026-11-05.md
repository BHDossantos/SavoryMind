# Hosted runtime incident: 5 November 2026

## Verified evidence

Render service `srv-d7ket9beo5us73aut9lg` uses main at `346bb6910d8bb9df525ff52bc8d550de7d44bc73`. Its latest live deployment is `dep-dbe9sujncjis73dht6dg` (October 24). Read-only Render logs show the origin `/health` returning 200 at 19:08:39 UTC on November 5. Earlier origin 503s exist. A healthy origin response does not establish canonical API availability or payment correctness.

At 19:08:32–36 UTC startup logs report SQLiteImpl and migrations from the initial baseline through head. This verifies use of SQLite by that instance. It does not establish whether DATABASE_URL is missing or explicitly SQLite, nor prove historical data loss. The separately provisioned `savorymind-db` PostgreSQL service is available, but a schema query was blocked by its empty external IP allowlist. No firewall changes were made.

DNS inspection returns `api.savorymind.net` CNAME `savorymind-api.onrender.com.` with Wix authoritative nameservers. The earlier canonical API check returned 503. The available Render connector cannot inspect custom-domain attachment/TLS status or secret environment values. Therefore the precise canonical-domain failure remains unverified. Do not treat Vercel's misconfigured status for this intentionally Render-hosted name as a reason to redirect DNS to Vercel.

## Code containment

Startup validation now detects managed hosting using RENDER_SERVICE_ID/K_SERVICE, explicit APP_ENV=production/prod, Sentry production environment, or the historical non-SQLite signal. It rejects hosted SQLite or blank DATABASE_URL and committed/blank signing and encryption defaults before migrations, seed or scheduler startup. Local SQLite development remains supported. URL scheme parsing prevents a PostgreSQL database named sqlite_backup from bypassing checks. Deep health retains its encryption-default diagnostic.

This intentionally prevents an unsafe deployment from starting. It does not migrate data, repair domains, configure production or restore service. Do not deploy it into the currently observed SQLite runtime without the prerequisites below.

## Required operational sequence

1. Preserve and securely inspect the currently running SQLite database before restart/redeploy. Determine whether it contains customer data and reconcile it with any existing PostgreSQL data; do not blindly copy or overwrite either database.
2. Inspect PostgreSQL schema through authorized internal access; the external allowlist must not be broadly opened to accommodate this tool.
3. Prepare and review a backup, migration/cutover and rollback plan. Configure the approved durable database only after reconciliation. Verify existing non-default signing and encryption keys without exposing values; changing encryption keys without a migration can strand encrypted integration tokens.
4. Inspect Render's custom-domain attachment, ownership verification and TLS state for api.savorymind.net. Repair the verified fault only, after required approval. Existing DNS evidence alone does not justify a DNS edit.
5. After approval, deploy the reviewed candidate and verify both canonical and origin health, authenticated onboarding and restaurant operations, persistence through restart, and billing checkout/webhook/cancellation in an approved test environment. Reconcile existing draft PR151 and monitoring PR150 before merge.

No production configuration, credentials, database, financial transaction, deployment or domain was changed in this work. A separate browser retry fix prevents automatic replay of ambiguous writes; it cannot repair a server/domain outage.

## Executed validation

Full backend suite: **592 passed, 16 subtests passed** (308 seconds); 12,622 warnings remain. Includes lifespan regression proving hosted SQLite is rejected before migration and seeding. Focused health/runtime suite before that final addition passed 26 tests and 16 subtests. The first full attempt exposed a removed constant in deep health; it was fixed and the entire suite rerun successfully. These tests run locally with SQLite and mocked integrations, not against production PostgreSQL or paid providers.
