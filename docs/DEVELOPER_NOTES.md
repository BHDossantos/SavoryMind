# SAVORYMIND — MASTER DEVELOPER NOTES FOR CLAUDE CODE
# Strategic rebuild: from feature-sprawl platform → focused B2B revenue engine
# Owner: Bruno Dos Santos | Stack: FastAPI (backend) + Next.js 14 (frontend)
# No timeline. Work by priority order (P0 → P3). Do not skip acceptance criteria.

---

## 0. HOW TO USE THIS DOCUMENT (READ FIRST, CLAUDE CODE)

- This file is the single source of truth for the SavoryMind pivot. When in doubt, re-read Section 1 (Strategy) — every technical decision must serve it.
- Before changing anything, run a discovery pass: map the repo (routes, API endpoints, DB schema, auth, i18n setup, existing modules). Write your findings to `docs/DISCOVERY.md` and reconcile them against the assumptions in this file. Where an assumption is wrong, adapt the instruction to reality — do not blindly implement.
- Work in this order: P0 (visibility + positioning) → P1 (money-number onboarding + module consolidation) → P2 (staff coaching engine + WhatsApp) → P3 (billing, pilot instrumentation, programmatic SEO).
- Every workstream has ACCEPTANCE CRITERIA. A workstream is not done until all criteria pass. Add automated tests where specified.
- Never delete the consumer (Food Person) code paths. Freeze them (Section 10). All new investment goes to the restaurant side.
- Keep commits small and scoped per workstream. Prefix: `[P0-SEO]`, `[P1-ONBOARD]`, etc.

---

## 1. STRATEGY (CONTEXT FOR EVERY DECISION)

**The business:** SavoryMind stops being "an AI platform with 20 modules" and becomes:

> **"We find €500–2,000/month your restaurant is losing — in waste, portioning, and staff time — and coach your team to stop it."**

**Why:** The current product has ~20 restaurant modules (Menu Analysis, Sentiment, Recommendations, Bookings, CRM, AI Predictions, Trends, Marketing, Food Waste, Inventory, Kitchen Timer, Staff Time, Staff Training, Employee Logins, Employee QR Codes, Billing…). Each one competes with a funded point solution (Toast, Lightspeed, 7shifts, SevenRooms, Winnow). Breadth kills sales. The unique, defensible asset is the **per-employee, euro-quantified loss detection + AI coaching plan** (e.g., "Carlos Mendes: €36.90 lost across 3 incidents, 1.7 kg — over-portioning + cooking error → action plan"). No competitor does this at SMB price points.

**Revenue model:** B2B SaaS. Tiers: Trattoria €149/mo, Ristorante €299/mo, Gruppo €599/mo. Annual = 2 months free. Offer/guarantee: 30-day free pilot; "if we don't identify ≥€500/month in recoverable losses, you don't pay."

**Market:** Rome first (12k+ restaurants), then Italy (~330k food businesses), then EU. Italian-first UX and copy; English second.

**Math target:** blended €200/mo → 420 restaurants ≈ €1M ARR; 1,400 ≈ €3.4M ARR. Everything below exists to (a) make the product findable, (b) make the first session show a money number, (c) make the coaching loop deliver weekly value, (d) collect the money.

**Consumer app:** demand/data layer only. Zero new features. Do not break it.

---

## 2. P0 — SEO / VISIBILITY RESCUE (THE SITE IS CURRENTLY INVISIBLE)

**Problem (verified):** savorymind.net serves only meta tags to crawlers. The body is 100% client-rendered. Google, Bing, Perplexity, ChatGPT, Claude see an empty page. The brand has ZERO indexed presence, while near-name competitors (savoryai.io, savoryai.net, saivory.com) occupy the results.

### 2.1 Rendering architecture
- Audit every route. Classify: MARKETING (public, must be crawlable) vs APP (authenticated, CSR is fine).
- MARKETING routes (`/`, `/ristoranti` (new), `/pricing`, `/come-funziona` (new), `/case-studies`, `/blog/*`, `/contatti`, legal pages) must be **Server Components with static rendering (SSG) or ISR**. No `use client` at the page level. Client interactivity only in leaf components.
- If the app currently uses the Pages Router, migrate marketing pages to the App Router; if already App Router, remove any top-level `'use client'` and any data fetching that forces dynamic rendering without need.
- Verify with `curl -s https://savorymind.net | grep -i "<h1"` — the full HTML including H1, body copy, pricing, and footer must be present in the raw response.

### 2.2 Technical SEO checklist (implement all)
- `app/sitemap.ts` → emits sitemap.xml with all marketing routes, both locales, `lastModified`.
- `app/robots.ts` → allow all marketing routes; disallow `/app`, `/dashboard`, `/api`, auth routes.
- `generateMetadata` per page: unique title (≤60 chars), description (≤155), canonical, OpenGraph + Twitter cards, `alternates.languages` for hreflang (it-IT, en-US, x-default → it).
- JSON-LD structured data:
  - Sitewide: `Organization` + `WebSite`.
  - `/ristoranti` + `/pricing`: `SoftwareApplication` with `offers` (the three tiers, EUR).
  - `/come-funziona`: `FAQPage` (min. 8 Q&As — waste cost, POS compatibility, GDPR, languages, guarantee, setup time, staff app, cancellation).
  - Case studies: `Article`.
- Performance budget: LCP < 2.5s on 4G, CLS < 0.1. Use `next/image`, font subsetting, no render-blocking third-party scripts on marketing pages.
- Add `llms.txt` at root summarizing what SavoryMind is, who it's for, pricing, and links — AI answer engines are a first-class discovery channel for this product.
- Submit sitemap to Google Search Console + Bing Webmaster (leave a `docs/SEO_OPERATIONS.md` note for Bruno with the exact steps; you cannot do the console part).

### 2.3 Acceptance criteria (P0-SEO)
- [ ] `curl` of every marketing URL returns full semantic HTML (H1, body content, footer) with JS disabled.
- [ ] Lighthouse SEO score ≥ 95 on `/`, `/ristoranti`, `/pricing` (both locales).
- [ ] sitemap.xml, robots.txt, llms.txt reachable and valid.
- [ ] Rich Results Test passes for FAQ + SoftwareApplication schema.
- [ ] hreflang pairs validate (no return-tag errors).

---

## 3. P0 — REPOSITIONED MARKETING SITE (B2B-FIRST)

The homepage currently speaks to consumers ("Tell us how you feel. We'll tell you what to eat."). Rebuild the public site to sell to restaurant owners, Italian-first. Keep a small secondary path for consumers.

### 3.1 Information architecture
```
/                    → B2B home (restaurant owners) [IT default, /en/ mirror]
/ristoranti          → product deep-dive (modules, screenshots)
/pricing             → tiers + guarantee + FAQ
/come-funziona       → 3-step how-it-works + demo video embed
/case-studies        → index + individual case study pages (CMS-able, see 8.3)
/per-chi-ama-il-cibo → consumer app landing (single page, links to app login)
/blog                → programmatic + editorial content (Section 9)
/contatti            → contact + WhatsApp CTA + demo booking
```

### 3.2 Homepage copy (implement verbatim, IT primary / EN secondary)

**Hero (IT):**
- H1: `Il tuo ristorante sta perdendo €500–2.000 al mese. Noi ti mostriamo dove.`
- Sub: `SavoryMind analizza sprechi, porzioni e tempi del tuo staff — e genera piani di coaching personalizzati per fermare le perdite. In 15 minuti vedi la tua prima cifra.`
- CTA primary: `Inizia la prova gratuita di 30 giorni` | CTA secondary: `Guarda la demo di 3 minuti`
- Trust line under CTA: `Se non troviamo almeno €500/mese di perdite recuperabili, non paghi.`

**Hero (EN):**
- H1: `Your restaurant is losing €500–2,000 a month. We show you where.`
- Sub: `SavoryMind analyzes waste, portioning, and staff time — then generates personalized coaching plans to stop the losses. See your first number in 15 minutes.`
- Same CTA/guarantee structure.

**Section 2 — The Carlos moment (social-proof-style product proof):** recreate the staff-coaching screen as a designed component (not a screenshot): employee card → `€36,90 persi · 3 episodi · 1,7 kg` → cause tags → generated action plan with checkboxes. Caption: `Ogni euro perso ha un nome, una causa e un piano per non perderlo più.` This is the emotional core of the page; make it the most polished component on the site.

**Section 3 — How it works (3 steps):** 1) Collega il gestionale o carica un export vendite → 2) SavoryMind trova le perdite e le quantifica in euro → 3) Il tuo staff riceve i piani di coaching su WhatsApp. 

**Section 4 — What's included:** the 6 visible modules (Section 5) as cards. Everything else under a single card: `E molto altro incluso` (bookings, CRM, sentiment, marketing…). Never lead with breadth.

**Section 5 — Pricing** (mirror of /pricing): three tiers, guarantee restated, annual toggle.

**Section 6 — FAQ** (same content as FAQ schema).

**Footer:** links, P.IVA placeholder, GDPR/privacy links, language switcher, `Made in Rome 🇮🇹`.

### 3.3 Design directives
- Restaurant side visual identity is the orange/warm palette already present in the app (the consumer side is purple — keep that separation consistent).
- Typography and spacing: premium, editorial, high contrast. No template look. Owner-aged audience (40–60): min 16px body, obvious CTAs.
- One demo video embed placeholder (Bruno will supply the asset).

### 3.4 Acceptance criteria (P0-SITE)
- [ ] IT and EN homepages live with the exact copy above (typographic refinement allowed, message identical).
- [ ] The "Carlos" component renders from real data types (reuses the coaching-plan model, not hardcoded strings — so a future real case study can be swapped in).
- [ ] Consumer landing exists and consumer signup flow still works end-to-end.
- [ ] All CTAs route to the restaurant trial signup with `?plan=` and `utm` passthrough preserved to the backend.

---

## 4. P1 — "MONEY NUMBER IN 15 MINUTES" ONBOARDING (THE MAKE-OR-BREAK FEATURE)

If the first session doesn't end with "you're losing €X/month," trials die. Build a Loss Discovery flow that produces a credible estimate fast, with progressively better data.

### 4.1 Flow (restaurant account, first login — replaces/augments current onboarding after the existing cuisine/audience questions)
1. **Quick profile** (keep existing questions: cuisine, dining style, services, seating) + add: covers/day (range), avg ticket (range), staff count, monthly food purchases € (range).
2. **Data source selection** — three paths, all must work:
   - **Path A — CSV/XLSX upload** of sales export (any POS). Build a resilient importer: auto-detect delimiter/encoding; fuzzy-map columns (date, item, qty, price, category) with a manual mapping UI fallback; store raw + normalized rows.
   - **Path B — Manual quick-audit** (no data): a 12-question guided audit (portioning practices, prep waste handling, inventory counting frequency, staff meal policy, top-3 dishes and their portion sizes vs. recipe). Each answer maps to loss coefficients.
   - **Path C — POS integration** (stub now, real later): create an integrations abstraction (`integrations/` module) with a provider interface; implement `csv` as the first provider; scaffold `lightspeed`, `tilby`, `cassanova` providers as TODO stubs (Italian market POS).
3. **Loss Estimate Engine** (backend service `loss_engine`):
   - Inputs: profile ranges + whichever data path.
   - Model: transparent, rule-based v1 (NOT a black box — owners must be able to see the reasoning):
     - Food waste baseline: 4–10% of food purchases depending on quick-audit answers (industry-standard band; cite range in UI as "settore: 4–10%").
     - Over-portioning: flag top-selling items where (Path A) margin variance or (Path B) reported portion vs recipe delta > 10% → € impact = delta% × item COGS × monthly volume.
     - Staff time leakage: (staff count × avg wage placeholder €9/hr configurable) × inefficiency coefficient from audit answers (prep duplication, no par levels, manual counting).
   - Output object: `{ total_monthly_loss_low, total_monthly_loss_high, breakdown: [{category, amount_low, amount_high, evidence[], confidence}] }`. Persist per restaurant with versioning (estimates improve as data improves).
4. **Reveal screen** — full-screen result: `Stima: stai perdendo tra €X e €Y al mese` with breakdown bars, confidence labels, and one CTA: `Attiva il piano di recupero` → creates the first coaching plans (Section 6) and schedules the WhatsApp digest.
5. **Guarantee logic hook:** if `total_monthly_loss_high < 500`, mark the account `guarantee_triggered` — trial does not convert to paid automatically; surface honest messaging (`La tua cucina è già molto efficiente — ecco cosa monitoreremo gratis`) and flag for Bruno's review. Never fake the number to hit €500. Credibility is the moat.

### 4.2 Acceptance criteria (P1-ONBOARD)
- [ ] A brand-new restaurant account reaches the Reveal screen in ≤15 minutes via Path B with zero uploads.
- [ ] Path A importer handles: comma/semicolon CSVs, Excel, Italian decimal commas, DD/MM/YYYY dates, UTF-8/Latin-1; malformed rows quarantined, not fatal.
- [ ] Estimate math is unit-tested with fixture datasets; every € figure in the UI traces to an evidence item.
- [ ] Reveal screen renders in IT and EN; numbers formatted per locale (€1.234,56 in IT).
- [ ] Analytics events fired at every step (Section 8.2).

---

## 5. P1 — MODULE CONSOLIDATION (CUT THE VISIBLE SURFACE TO 6)

### 5.1 Visible navigation (restaurant side) becomes exactly:
1. **Dashboard** (keep; add the Loss Estimate as the hero card: current monthly loss estimate + recovered-to-date counter)
2. **Perdite & Sprechi** (merge current Food Waste + Inventory)
3. **Coaching Staff** (merge Staff, Staff Time, Staff Training, Employee Logins, Employee QR Codes into one hub with tabs)
4. **Menu & Margini** (merge Menu Analysis + Recommendations + Trends)
5. **AI Predictions** (keep)
6. **Impostazioni & Billing** (merge Billing + settings + employee QR/login management)

### 5.2 Everything else (Bookings, CRM, Sentiment, Marketing, Kitchen Timer, Reports…):
- Do NOT delete. Move behind a feature-flag system (`feature_flags` table or config: per-plan, per-account overrides).
- Group them in nav under a single collapsed item: `Altri strumenti (incluso)`.
- Ristorante tier and above: flags on. Trattoria: flags visible but locked with an upgrade prompt (reuse the existing Premium-lock pattern seen in Meal Planner/Wine Pairing, restyled for B2B).

### 5.3 Acceptance criteria (P1-MODULES)
- [ ] Sidebar shows exactly 6 items + 1 collapsed group; no dead links.
- [ ] Feature flags controllable per account without deploy (admin endpoint or DB toggle).
- [ ] No existing data is lost; hidden modules remain fully functional when flag is on.
- [ ] E2E test: Trattoria account sees locks; Ristorante account sees features.

---

## 6. P2 — STAFF COACHING ENGINE v2 (THE PRODUCT'S SOUL)

The existing coaching plans (waste alert / prep speed / punctuality per employee with action checklists) are the differentiator. Industrialize them.

### 6.1 Data model (extend, don't replace)
- `employees` (exists via Employee Logins): add `role`, `hourly_cost` (optional), `whatsapp_number` (E.164, consented), `language`.
- `incidents`: `{employee_id, type: waste|portioning|speed|punctuality|quality, occurred_at, quantity, unit, euro_impact, cause_tags[], source: manual|import|inferred, notes}`.
- `coaching_plans`: `{employee_id, period, priority, title, summary, euro_impact_total, actions: [{text, done, due_hint}], status: draft|active|completed, generated_by_model, reviewed_by_owner}`.
- Manual incident entry must be ≤20 seconds on mobile: big-button quick-log screen (who → what → how much) usable during service. This is the primary data source until POS integrations mature — optimize it obsessively.

### 6.2 Plan generation (LLM service)
- Backend service `coaching_generator` calling the LLM with a strict system prompt. Requirements:
  - Input: employee profile + last 30 days of incidents + restaurant context (cuisine, size).
  - Output: strict JSON (validate with Pydantic): priority level, quantified summary (must reference real € and kg figures from incidents — never invent numbers), 3–5 concrete actions, expected recovery estimate.
  - Language: generate in the restaurant's locale AND the employee's language if different (Rome kitchens are multilingual — Italian, Spanish, Bengali, Arabic are common; support at minimum it/en/es).
  - Tone constraints in the prompt: constructive, dignity-preserving, specific. Coaching, never punishment. Include a hard rule: no personal criticism, only process fixes.
- Owner review step: plans are `draft` until the owner taps approve (one tap, bulk-approve allowed). Approved → delivered.
- Weekly regeneration job (cron/celery/apscheduler — match existing infra) that refreshes plans and computes `recovered €` (incidents trend vs. baseline) for the Dashboard counter.

### 6.3 Acceptance criteria (P2-COACHING)
- [ ] Quick-log an incident on a phone in ≤3 taps + one number.
- [ ] Generated plan JSON always validates; a failed generation degrades gracefully (retry + owner notification), never a blank screen.
- [ ] Every € figure in a plan is traceable to incident rows (assert in tests).
- [ ] Multi-language generation verified for it/en/es fixtures.
- [ ] Dashboard "recuperato questo mese" counter computed and correct on fixture data.

---

## 7. P2 — WHATSAPP DELIVERY (STAFF WILL NEVER OPEN A DASHBOARD)

- Integrate WhatsApp via Meta Cloud API (preferred; direct, cheaper) with Twilio as fallback provider behind a `messaging/` provider interface.
- Message types (template-approved, it/en/es):
  1. **Daily staff digest** (to each employee, morning): today's focus from their active plan (1–2 actions max).
  2. **Owner weekly report** (Sunday evening): losses this week, recovered €, top improver, one attention point.
  3. **Booking alert passthrough** (the app already advertises SMS alerts for bookings — unify onto WhatsApp).
- Consent: explicit opt-in flow per employee (owner enters number → employee receives opt-in message → stored consent timestamp). GDPR: document lawful basis; add data-processing note to privacy policy; provide per-employee delete/export.
- All sends logged (`message_log`) with delivery status webhooks.

### Acceptance criteria (P2-WHATSAPP)
- [ ] Sandbox end-to-end test: incident → plan → approved → digest received on a test number.
- [ ] Opt-in/opt-out fully functional; unsubscribed numbers are never messaged.
- [ ] Provider swap (Meta ↔ Twilio) requires config change only.

---

## 8. P3 — BILLING, GUARANTEE MECHANICS, AND PILOT INSTRUMENTATION

### 8.1 Stripe billing
- Products/prices: Trattoria €149/mo, Ristorante €299/mo, Gruppo €599/mo; annual prices = 10× monthly (2 months free). EUR, Italian VAT-ready (Stripe Tax on).
- 30-day trial on all tiers, card optional at start (card-optional trials convert better in this segment; require card at day 25 via email/WhatsApp nudge).
- Guarantee flow: if `guarantee_triggered` (Section 4.1.5) → block auto-conversion, notify Bruno (email/webhook), owner sees honest messaging. Manual override available.
- Replace/wire the existing `Subscribe — €99/mo` button seen in-app to the new tier system; migrate any existing subscribers' plan mapping explicitly (write a migration note in `docs/BILLING_MIGRATION.md`).
- Dunning: Stripe Smart Retries + WhatsApp payment-failed nudge.

### 8.2 Analytics & pilot instrumentation (case studies are the growth engine)
- Event schema (server-side, plus lightweight client events): `signup_started`, `experience_selected`, `onboarding_step_completed`, `data_path_selected`, `import_succeeded/failed`, `loss_estimate_revealed` (with amount band), `plan_generated/approved/delivered`, `incident_logged`, `digest_sent/read`, `trial_converted`, `guarantee_triggered`, `churned`.
- Store in Postgres events table (simple, queryable) + optional PostHog if a key is configured.
- Build an internal `/admin/pilots` view: per-restaurant funnel, loss found, recovered €, engagement — everything Bruno needs to write a case study without asking engineering.

### 8.3 Case-study content type
- Simple CMS approach: MDX files in `content/case-studies/` rendered by the marketing site (IT/EN frontmatter), with structured fields: restaurant type, neighborhood, loss found €, recovered €/mo, quote. Ship one realistic-but-clearly-labeled example (`Esempio dimostrativo`) until real pilots replace it. Never present demo data as a real client.

### Acceptance criteria (P3)
- [ ] Full trial→paid flow works in Stripe test mode for all 3 tiers, monthly + annual.
- [ ] Guarantee-triggered accounts cannot be auto-charged.
- [ ] Every event above visible in `/admin/pilots` for a seeded fixture restaurant.

---

## 9. P3 — PROGRAMMATIC SEO (COMPOUNDING INBOUND, ITALIAN-FIRST)

- Template 1 — Cost-of-waste pages: `/blog/spreco-alimentare-ristorante-[tipo]` (pizzeria, trattoria, sushi, pasticceria, bar…): data-driven template (typical waste %, € bands by covers, 3 fixes, CTA to Loss Discovery). ~15 pages at launch, generated from a data file, unique intros (LLM-drafted, human-reviewable in MDX).
- Template 2 — Comparison pages: `/confronto/savorymind-vs-[competitor]` for winnow, toast, lightspeed, sevenrooms, saivory: honest feature/price comparison emphasizing per-employee coaching + SMB pricing. (Also directly defends the brand-collision problem with SavoryAI/Saivory.)
- Template 3 — Free tool: `/calcolatore-spreco` — public, no-signup calculator (inputs: covers/day, avg ticket, food cost %) → instant € loss band → email-gate the detailed PDF report. This is the #1 lead magnet; wire it to the same `loss_engine` in "public estimate" mode.
- All templates: unique metadata, FAQ schema, internal links to /pricing, IT canonical + EN variants for template 3 only.

### Acceptance criteria (P3-SEO)
- [ ] 15+ waste pages + 5 comparison pages + calculator live, statically rendered, indexed-ready.
- [ ] Calculator produces the same math as onboarding Path B (shared engine, one source of truth).
- [ ] Email capture on calculator stores leads with UTM + answers for sales follow-up.

---

## 10. CONSUMER SIDE — FREEZE PROTOCOL

- Do not remove: signup, persona quiz, Cook/Flavor/Dine Out/Profile, premium gates.
- Do not build any new consumer features regardless of how easy they look.
- Allowed touches only: (a) shared infrastructure/security fixes, (b) the new `/per-chi-ama-il-cibo` landing, (c) renaming "Premium" price points if they collide with new Stripe products.
- Add a smoke-test suite for the consumer funnel (signup → quiz → dashboard → hit a premium gate) so B2B work can't silently break it.

---

## 11. CROSS-CUTTING ENGINEERING STANDARDS

- **Multi-tenancy & security:** every restaurant-scoped query must filter by tenant/restaurant_id at the ORM layer (add a review pass + tests for cross-tenant leakage on all new endpoints, especially employee data and incidents). Employee QR/passwordless logins: scoped tokens, no access to owner-level data.
- **GDPR:** employees and diners are EU data subjects. Data inventory doc (`docs/GDPR.md`), per-subject export/delete endpoints, WhatsApp consent records, LLM calls must not send more personal data than needed (send employee first name + metrics, never full contact details, to the model).
- **i18n:** all new strings through the i18n layer from day one (it, en, es). Italian is the default locale. Currency/number/date formatting via locale-aware utils only.
- **Performance:** dashboard initial load < 2s on a mid-range Android phone over 4G — restaurant owners live on their phones.
- **Error states:** every async screen needs loading/empty/error states (the current app shows raw spinners and blanks). Empty states must sell the next action (e.g., empty incidents → "Registra il primo episodio in 20 secondi").
- **Testing:** unit tests for loss_engine and coaching_generator validators; E2E (Playwright) for: restaurant onboarding Path B, incident quick-log, plan approve, trial checkout, consumer smoke suite.
- **Docs:** maintain `docs/DISCOVERY.md`, `docs/BILLING_MIGRATION.md`, `docs/GDPR.md`, `docs/SEO_OPERATIONS.md` as you go. These are for Bruno — write them for a smart non-engineer.

---

## 12. EXPLICIT NON-GOALS (DO NOT BUILD)

- No native mobile apps (PWA polish only).
- No new consumer features (Section 10).
- No new restaurant modules beyond the 6 + flagged extras.
- No real-time POS webhooks in v1 (CSV + manual first; provider stubs only).
- No multi-location/enterprise features until Gruppo tier has real demand.
- No fake numbers anywhere: demo data must be labeled, estimates must show ranges + confidence, the guarantee must be honest. Credibility IS the product.

---

## 13. DEFINITION OF DONE (WHOLE PROGRAM)

1. A stranger can Google "spreco alimentare ristorante" or "SavoryMind" and land on an indexed, fast, Italian page that promises the money-finding outcome.
2. A restaurant owner can sign up, answer questions for 15 minutes with no data files, and see "stai perdendo tra €X e €Y al mese" with a credible breakdown.
3. They can log a waste incident from the kitchen in under 20 seconds; by the weekend, each staff member has a dignified, specific coaching plan on WhatsApp.
4. The dashboard shows losses found and money recovered, in euros, cumulatively.
5. Stripe collects €149/€299/€599 monthly with a working trial and an honest guarantee.
6. Bruno can open `/admin/pilots` and pull everything needed for a case study without touching code.

When all six are true, SavoryMind is structurally a multi-million-euro business waiting on sales reps and case studies — which is Bruno's job, not this codebase's.
