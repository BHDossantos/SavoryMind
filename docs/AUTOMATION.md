# Build & deploy automation

The whole pipeline is now hands-off: merge to `main` → tests gate → everything
deploys. Here's what runs and the one-time setup to turn deploys on.

## What's automated

| Stage | Workflow | Trigger | Status |
|-------|----------|---------|--------|
| Backend + frontend tests | `ci.yml` | every push & PR to `main` | ✅ on |
| Mobile tests | `mobile-ci.yml` | every push & PR to `main` | ✅ on |
| **Web + API deploy (Render)** | `render-deploy.yml` | after **CI passes** on `main` | ⚙️ needs 2 secrets (below) |
| Mobile app build (iOS + Android) | `eas-mobile-build.yml` | push to `main` under `mobile/**` | ✅ on (needs `EXPO_TOKEN1`, already set) |

Net effect once the two secrets below are set: **open a PR → CI runs → merge →
web + API redeploy automatically, only if tests passed.** No manual Render
deploys ever again.

## One-time setup: turn on auto-deploy (≈3 min)

`render-deploy.yml` deploys via Render **Deploy Hooks** (a private URL per
service that triggers a build of the latest `main`). Gating on CI means a red
build never ships.

1. In Render, open **`savorymind-api` → Settings → Deploy Hook** → copy the URL.
2. Open **`savorymind-web` → Settings → Deploy Hook** → copy that URL.
3. In GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `RENDER_DEPLOY_HOOK_API` = the savorymind-api hook URL
   - `RENDER_DEPLOY_HOOK_WEB` = the savorymind-web hook URL
4. In Render, keep each service's own **Auto-Deploy = Off** (so you don't deploy
   twice — the workflow is now in charge).

That's it. Until the secrets exist, the deploy job logs a notice and no-ops, so
nothing breaks in the meantime.

### Simpler alternative (no secrets, no gate)
If you'd rather not gate on tests, you can instead flip Render's native
**Auto-Deploy = On** for both services and ignore `render-deploy.yml`. Merges to
`main` then deploy immediately. Tradeoff: Render only checks that the build
*compiles* — it won't block a deploy on failing app tests. The hook approach
above is recommended because it won't ship a commit whose tests fail.

> Don't enable **both** native Auto-Deploy **and** the deploy hooks — that
> double-deploys on every merge. Pick one.

## Rolling back
Render keeps every deploy. To roll back: service → **Deploys** → pick a previous
successful deploy → **Rollback**. One click, no git revert needed.

## Retired (dead Google Cloud) workflows
These are disabled (`*.disabled`) — they ran against the terminated GCP project
and are kept only for reference:
`deploy-backend.yml`, `deploy-frontend.yml`, `terraform.yml`, `setup-dns.yml`.

Still-GCP-flavored and worth a look later (not blocking): `seed-restaurants.yml`,
`seed-test-accounts.yml` (seed scripts that pointed at the old Cloud Run URL),
and `ai-healthcheck.yml` (could be repurposed as a live uptime check against
`https://api.savorymind.net/health`).
