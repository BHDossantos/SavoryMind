# DISCOVERY — repo reality vs. the Master Notes

Written for Bruno. This maps what actually exists in the codebase against the
assumptions in `docs/DEVELOPER_NOTES.md`, and records the adaptation decisions
where the two disagree. Every pivot workstream reconciles against this file.

---

## 1. Architecture reality

| Notes assume | Reality | Decision |
|---|---|---|
| Next.js 14, possibly App Router | **Next.js 15 (Pages Router)**, `output: "standalone"`, deployed on **Google Cloud Run** (not Vercel) | Keep the Pages Router. Marketing pages become statically-renderable Pages Router pages with **hardcoded IT/EN copy** (no client i18n dependency), which makes them fully crawlable without a router migration. Revisit App Router only if ISR becomes necessary. |
| Site invisible because client-rendered | Confirmed, but the precise cause: every marketing string goes through **client-only react-i18next** (`localStorage`/navigator detection, no server locale). The SSR HTML contains translation *keys*, not copy. The auth gate in `_app.js` additionally spinner-blocks any route not in `PUBLIC_ROUTES`. | New marketing pages hardcode their copy in the JSX (IT primary, `/en/*` mirrors), so the full text is in the server-rendered HTML. Each new route is added to `PUBLIC_ROUTES`. |
| sitemap/robots exist somewhere | **None exist.** `frontend/public/` is empty. | Build `robots.txt` + `llms.txt` as static files, `sitemap.xml` as a server-rendered route. |

**Latent hazard fixed during discovery:** `frontend/package.json` declared `next`
twice (`^16.1.5` and `^15.5.15`). Installed reality is 15.5.18. The stray 16.x
line is removed.

## 2. What already exists for the pivot (better than the notes assume)

- **The "Carlos moment" is already computed.** `waste_service.get_waste_summary`
  produces per-staff `{name, total_cost, total_kg, incidents}` sorted by € —
  exactly the marketing hero component's data shape. Caveat: attribution is by
  free-text `staff_name`, not a foreign key. P2 adds reconciliation.
- **A coaching-plan generator exists.** `training_service.py` joins waste +
  dish-time + staff, builds per-employee profiles, and calls Claude
  (`claude_client.call_json`, strict JSON schema) with a rules fallback that
  emits priority/title/actions plans. P2 industrializes this rather than
  building from zero.
- **A 3-tier entitlement system is scaffolded.** `core/entitlements.py` defines
  starter/growth/pro with a feature→min-tier map. But: the Stripe webhook never
  sets `restaurant_tier`, and the billing UI sells a flat €99. P3 rewires this
  to Trattoria €149 / Ristorante €299 / Gruppo €599.
- **Cron infra is proven.** `/internal/jobs/*` with Cloud Scheduler OIDC — the
  weekly coaching digest and WhatsApp jobs follow this pattern.
- **Server+client analytics exist.** PostHog wired both sides with PII
  stripping; the P3 events table complements (not replaces) it.
- **Inventory is audit-grade.** Append-only adjustment ledger with
  waste/usage/delivery/count types — Perdite & Sprechi merges Waste + this.
- **Multi-tenancy pattern:** owner `User.id` is the tenant key; every
  restaurant table carries `user_id`. Staff logins are `User` rows with
  `account_type="staff"` + `employer_id`, forced to `/staff-portal`.

## 3. Greenfield (nothing to reuse)

- **CSV/XLSX import** — only export exists. Path A importer is new code.
- **WhatsApp** — Twilio SMS only; "whatsapp_message" fields today are generated
  copy the operator pastes by hand. The messaging provider interface is new.
- **Loss Estimate Engine** — new service; but its inputs (waste logs, sales
  logs, inventory, staff) all have existing models.
- **Feature-flag admin** — entitlements exist; per-account override table is new.
- **Employee fields** — `Staff` lacks `hourly_cost`, `whatsapp_number`,
  `language`; `incidents` and `coaching_plans` tables are new (migrating from
  the implicit FoodWasteLog/DishTimeLog signals).

## 4. Current module inventory → consolidation map

23 sidebar entries today (`components/Layout.js`). Target 6 + 1 collapsed group:

| Target | Absorbs (today's routes) |
|---|---|
| Dashboard | `/dashboard` (+ Loss Estimate hero card) |
| Perdite & Sprechi | `/restaurant/waste`, `/restaurant/inventory` |
| Coaching Staff | `/restaurant/staff`, `/restaurant/stafftime`, `/restaurant/training`, `/restaurant/employees`, `/restaurant/employee-qr-codes` |
| Menu & Margini | `/menu`, `/recommendations`, `/restaurant/trends` |
| AI Predictions | `/restaurant/predictions` |
| Impostazioni & Billing | `/restaurant/billing`, `/restaurant/integrations`, settings |
| «Altri strumenti (incluso)» | `/restaurant/bookings`, `/restaurant/crm`, `/sentiment`, `/restaurant/marketing`, `/restaurant/kitchen`, `/restaurant/operations`, `/restaurant/schedule`, `/reports`, `/restaurant/assistant` |

Hardcoded-path hazards before renaming anything: `homePath()` in `_app.js`,
staff force-redirect, Stripe success/cancel URLs (`config.py`), email/SMS
deep-links, and `Link`/`router.push` calls across the 20+ restaurant pages.
Consolidation keeps existing URLs working (nav regroups; routes stay).

## 5. Consumer freeze — what the smoke suite must cover

signup (`account_type=consumer`) → forced `/onboarding` (12-step quiz) →
`/consumer/dashboard` → a premium gate (`PremiumGate` → `/consumer/upgrade` →
Stripe checkout → webhook flips plan). Wedge paths (`/discover/mood`,
`/discover/menu`) feed onboarding via `wedgeTaste` and must keep working.

## 6. Other reconciliations

- Locales: web has en/es/it/pt/fr, but the Claude persona covers only
  en/es/it/pt — French operators get English-voiced AI. Not a pivot blocker
  (pivot needs it/en/es).
- Mobile apps exist and are store-ready, but per the notes they're a non-goal:
  frozen alongside the consumer side, no store submission.
- Waste €/currency symbols are inconsistent (`$` in waste tips, `£` in a
  training string) — normalize to locale-aware € formatting during P1.
