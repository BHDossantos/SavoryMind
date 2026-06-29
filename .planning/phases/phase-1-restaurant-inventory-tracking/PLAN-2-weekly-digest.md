# Plan 2: Weekly Low-Stock Digest Job

**Phase:** 1 — Restaurant Inventory Tracking
**Goal:** Restaurants get one in-app notification + one Resend email each week summarizing items below par level. Triggered by Cloud Scheduler hourly on Mondays, filters per-restaurant timezone.
**Estimated commits:** 1 atomic
**Estimated tests added:** ~3

## Tasks

1. **Internal route** (`backend/app/api/routes/inventory.py` — added to existing module from Plan 1)
   - `POST /internal/jobs/inventory-digest` — separate sub-router, no `require_restaurant` gate
   - OIDC token validation: read `Authorization: Bearer <token>`, verify with Google's tokeninfo or local JWKS verification (use `google.auth` library — already a transitive dep via google-cloud-sql), verify audience matches the endpoint URL, verify issuer is `https://accounts.google.com`, verify the email claim matches the configured scheduler service account
   - Service account email comes from env: `SCHEDULER_SERVICE_ACCOUNT` (default: `scheduler-runner@<project>.iam.gserviceaccount.com`)
   - Returns 401 on auth failure, 200 with stats on success

2. **Service** (`backend/app/services/inventory_digest_service.py` — new module)
   - `run_digest(db, now=None) -> dict` — main entry point, callable both from the route AND from tests/manual ops
   - For each restaurant user (account_type=restaurant, archived=False):
     - Compute their local hour using `zoneinfo.ZoneInfo(user.timezone)`
     - Skip unless local weekday == Monday AND local hour == 8
     - Get low-stock items via `inventory_service.get_low_stock_items(db, user.id)`
     - If list empty: skip (no spam for restaurants who are stocked up)
     - Idempotency: compute `week_start = monday_of_current_iso_week_in_user_tz`. Look up existing notification matching `(user_id, link='/restaurant/inventory', message LIKE 'Weekly inventory digest:%', created_at >= week_start_utc)`. If exists, UPDATE message + reset `read=False`. Else INSERT new.
     - Send email via Resend if `RESEND_API_KEY` set AND user.email is verified-looking (skip emails to `*@social` placeholder addresses from social_login)
   - Return `{"restaurants_processed": N, "notifications_created": M, "notifications_updated": U, "emails_sent": K, "skipped_no_low_stock": S, "skipped_wrong_time": W}`

3. **Resend email template** (inline HTML in `inventory_digest_service.py`)
   - Subject: `"Weekly inventory check: 12 items below par"` (count from items)
   - Body: brief intro + table (item / category / current / par / unit) sorted by category. Max 30 rows. Footer with "View all in dashboard" link to `https://savorymind.net/restaurant/inventory`.
   - Plain HTML, no template engine. Send via `resend.Emails.send()` SDK call (`resend` package).

4. **Resend client wrapper** (`backend/app/services/resend_client.py` — new module)
   - `send_email(to: str, subject: str, html: str) -> bool` — returns True on success, False on any failure (logs but doesn't raise)
   - No-op when `RESEND_API_KEY` env var unset (returns False, logs `"Resend not configured — email skipped"`)
   - Uses `from = "Savorymind <noreply@savorymind.net>"` (configurable via `RESEND_FROM_ADDRESS` env, defaults to that)

5. **Add `resend` to requirements.txt**
   - `resend>=2.0,<3.0` (current major version)

6. **Tests** (`backend/tests/test_inventory_digest.py` — new file, ~3 tests)
   - `test_digest_creates_notification_for_low_stock` — seed 1 restaurant + 2 items, one below par; mock `now` to a Monday 8am in their TZ; assert 1 notification row + (with mocked Resend) 1 email send
   - `test_digest_skips_when_no_items_below_par` — seed restaurant with all items at/above par; assert 0 notifications
   - `test_digest_idempotent_within_same_week` — call twice with same `now`; assert second call updates the same notification row, doesn't create a second; `notifications_updated` count == 1 on second call

7. **OIDC auth tests** — separate (~2 small tests inline in `test_inventory_digest.py`):
   - `test_digest_endpoint_rejects_no_token` — POST without auth → 401
   - `test_digest_endpoint_rejects_wrong_audience` — POST with token for different audience → 401
   - (Real Google token verification is mocked — patch `google.oauth2.id_token.verify_oauth2_token` to return controlled claims)

## Test Verification

```bash
cd backend
pytest tests/test_inventory_digest.py -v   # 3-5 new tests
pytest                                      # full suite green
```

## Success Criteria

1. ✓ `run_digest(db, now=monday_8am_in_ny_tz)` for a restaurant in `America/New_York` with 3 items below par creates exactly 1 notification + (with key set) 1 email
2. ✓ Re-running same hour is idempotent (UPDATE not INSERT)
3. ✓ Restaurants in non-Monday-8am-local timezones are skipped
4. ✓ Internal endpoint rejects unauthenticated calls
5. ✓ Job behaves correctly with `RESEND_API_KEY` unset (notification still created, email silently skipped)

## Dependencies

- Depends on Plan 1: `inventory_service.get_low_stock_items` must exist
- Plan 3 (UIs) does not depend on this — UIs just consume `/api/inventory/*` from Plan 1

## Deploy runbook (NOT executed by Plan 2 — operator-side)

Code ships in this PR but the Cloud Scheduler job creation requires gcloud access. After merge, operator runs:

```sh
# 1. Create scheduler service account if not exists
gcloud iam service-accounts create scheduler-runner \
  --display-name="Cloud Scheduler invoker for backend jobs"

# 2. Grant invoker role on the backend Cloud Run service
gcloud run services add-iam-policy-binding savorymind-backend \
  --region=us-central1 \
  --member="serviceAccount:scheduler-runner@<PROJECT>.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# 3. Set the scheduler service account env var on backend
gcloud run services update savorymind-backend \
  --region=us-central1 \
  --update-env-vars="SCHEDULER_SERVICE_ACCOUNT=scheduler-runner@<PROJECT>.iam.gserviceaccount.com"

# 4. Create the scheduler job
gcloud scheduler jobs create http inventory-weekly-digest \
  --location=us-central1 \
  --schedule="0 * * * 1" \
  --time-zone="UTC" \
  --uri="https://api.savorymind.net/internal/jobs/inventory-digest" \
  --oidc-service-account-email=scheduler-runner@<PROJECT>.iam.gserviceaccount.com \
  --oidc-token-audience="https://api.savorymind.net/internal/jobs/inventory-digest"

# 5. Trigger once to verify
gcloud scheduler jobs run inventory-weekly-digest --location=us-central1
```
