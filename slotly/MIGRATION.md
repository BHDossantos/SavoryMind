# Migrating Slotly to BHDossantos/Slotly

The Slotly project lives at `slotly/` inside the `BHDossantos/SavoryMind` repository (the original SavoryMind product is parked alongside it). This guide moves it into its own dedicated repo at `https://github.com/BHDossantos/Slotly` while preserving history.

## Why a separate repo

- Slotly is the active product; SavoryMind is the legacy.
- A clean repo means the GitHub project page, issues, and PRs are all about Slotly.
- The GSD planning files (`slotly/.planning/`) live next to the code they describe.

## What you need

- `git` (any recent version)
- `git-filter-repo` — the cleanest tool for subtree extraction. Install:
  ```bash
  pip install git-filter-repo            # macOS / Linux
  brew install git-filter-repo           # alternative on macOS
  ```
- An empty `BHDossantos/Slotly` repo on GitHub (no README, no .gitignore — leave it empty so the import is clean)
- Push access to that repo

## What gets migrated

History walk:

1. The 5 feature commits originally on `availablenow/` (paths get rewritten to `slotly/` then stripped of the prefix)
2. The 2 rebrand commits on `slotly/`
3. The `.planning/` + `MIGRATION.md` commit (also on `slotly/`)

After migration, every commit in the new repo will look as if Slotly was always at the repo root.

## Migration script

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run from anywhere. This script clones SavoryMind to a temp dir,
# rewrites history so slotly/ becomes the root, then pushes to Slotly.

WORK_DIR="$(mktemp -d -t slotly-migrate-XXXXXX)"
SOURCE_REMOTE="${SOURCE_REMOTE:-git@github.com:BHDossantos/SavoryMind.git}"
SOURCE_BRANCH="${SOURCE_BRANCH:-claude/appointment-booking-platform-FYizt}"
TARGET_REMOTE="${TARGET_REMOTE:-git@github.com:BHDossantos/Slotly.git}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"

echo "Cloning $SOURCE_REMOTE branch $SOURCE_BRANCH -> $WORK_DIR"
git clone --branch "$SOURCE_BRANCH" --single-branch "$SOURCE_REMOTE" "$WORK_DIR"
cd "$WORK_DIR"

# Step 1: rename old availablenow/ paths to slotly/ across all history.
# This makes the feature commits look like they were always on slotly/.
echo "Rewriting history: availablenow/ -> slotly/"
git filter-repo --force --path-rename availablenow/:slotly/

# Step 2: strip everything outside slotly/, then strip the slotly/ prefix.
echo "Extracting slotly/ as the repo root"
git filter-repo --force --subdirectory-filter slotly

# Step 3: point at the new remote and push.
echo "Pushing to $TARGET_REMOTE branch $TARGET_BRANCH"
git remote add origin "$TARGET_REMOTE"
git branch -M "$TARGET_BRANCH"
git push -u origin "$TARGET_BRANCH"

echo "Done. Slotly is now at $TARGET_REMOTE on branch $TARGET_BRANCH"
echo "Working clone left at: $WORK_DIR"
```

The script is also available at `slotly/migrate-to-slotly.sh` for direct execution:

```bash
chmod +x slotly/migrate-to-slotly.sh
slotly/migrate-to-slotly.sh
```

Override defaults with environment variables if you need to:

```bash
SOURCE_BRANCH=main TARGET_BRANCH=main ./slotly/migrate-to-slotly.sh
```

## Verifying the migration

After the push:

```bash
git clone git@github.com:BHDossantos/Slotly.git slotly-verify
cd slotly-verify
ls                       # should show: backend/ frontend/ .planning/ README.md ...
git log --oneline | head # should show the 5 feature commits + rebrand + GSD docs
```

Smoke test the renamed app:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --port 8001 &
curl -s http://localhost:8001/health   # {"status":"ok"}
```

```bash
cd ../frontend
npm install
npm run build           # passes
```

## What about the SavoryMind repo

The `slotly/` directory stays in `BHDossantos/SavoryMind` until you confirm the new repo is healthy. Once verified:

```bash
# In SavoryMind, on a cleanup branch
git rm -r slotly/
git commit -m "chore: remove slotly/ — moved to BHDossantos/Slotly"
git push
```

Don't delete `slotly/` from SavoryMind until the Slotly repo is verified working.

## Rollback

If anything goes wrong, the source `BHDossantos/SavoryMind` repo is untouched — the script only operates on a temp clone. Re-run with corrected env vars.

## What this script does NOT do

- It does not configure GitHub Actions, branch protection, secrets, or any other repo-level settings on `BHDossantos/Slotly`. Set those up via the GitHub UI after the push.
- It does not invite collaborators, set up the repo description, or add topics. Do those manually.
- It does not handle git LFS — Slotly has no LFS objects, so this is fine.
