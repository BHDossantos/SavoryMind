# Stripe billing setup

DealFlow ships ready to take money. This walks through what you have to do
on the Stripe side before the Upgrade buttons start working.

You can do every step in **test mode** first (`sk_test_…` keys). Nothing
charges a real card until you swap to live keys.

## 1. Create a Stripe account (one-time, ~5 minutes)

1. Go to **https://dashboard.stripe.com/register**, sign up.
2. You can skip the "activate live payments" flow — test mode works without
   the legal business details.

## 2. Grab two keys

In the Stripe dashboard (top right has a **Test mode** toggle — leave it on):

- **Developers → API keys → Secret key** → copy. This is `STRIPE_SECRET_KEY`.
  Starts with `sk_test_`.

Paste it into `dealflow/.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Don't commit `.env.local`. It's already in `.gitignore`.

## 3. Seed the Pro and Team products

```bash
cd dealflow
npm run stripe:seed
```

The script is idempotent. It looks for existing products tagged
`metadata.dealflow_tier=<tier>`; reuses if found, creates otherwise. It
writes the resolved IDs back into `lib/billing/prices.json`.

**Commit `lib/billing/prices.json`** so production matches dev:

```bash
git add dealflow/lib/billing/prices.json
git commit -m "chore(dealflow): seed Stripe product/price IDs"
```

(The file holds public IDs, not secrets — safe to share.)

## 4. Wire up webhooks (dev)

In a separate terminal:

```bash
# One-time: install the Stripe CLI from stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
```

The `listen` output prints a `whsec_…` value. Paste it into `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Keep `stripe listen` running while you're testing locally.

## 5. Try it

```bash
npm run dev
```

Then:

1. Sign up at `/signup`.
2. Visit `/pricing` — three tiers should render with active Upgrade buttons.
3. Click **Upgrade** on Pro. Stripe Checkout opens.
4. Use a test card: `4242 4242 4242 4242`, any future expiry, any CVC, any
   ZIP.
5. After completion, you land on `/billing/success`. The page polls until
   the webhook updates your workspace to `pro`.
6. Header now shows a **Pro** badge.
7. Visit `/settings/billing` and click "Manage subscription" to verify the
   customer portal flow.

## 6. Production checklist (when you're ready to go live)

1. Activate live payments in Stripe.
2. Swap `STRIPE_SECRET_KEY` for the **live** key (`sk_live_…`).
3. Re-run `npm run stripe:seed` against live — it will create live-mode
   products and update `prices.json`. (Yes, you do want different files for
   test vs live; manage with env-specific deploy configs, or have the
   script write to a different filename per mode. Future improvement.)
4. In Stripe dashboard → Developers → Webhooks → **+ Add endpoint**:
   - URL: `https://yourdomain.com/api/billing/webhook`
   - Events to send: `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.paid`,
     `invoice.payment_failed`.
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET` env var in prod.
5. Confirm the success URL in `prices.json` / app config points at your
   real domain.

## What happens without keys?

- `/pricing` renders, but Upgrade buttons are disabled with a small
  "Billing not configured" caption.
- The free tier still works fully (3 deals, no AI).
- `/api/billing/*` endpoints return `503` with a clear message.
- No 500s, no crashes.

This means you can ship Phases 6–7 and let people try the product on Free
before you finish step 5.
