# FitNow Transfer — One-Time Bridge

This directory is a **one-time bridge** that ships the FitNow project skeleton
(plus the GSD workflow install) from the SavoryMind repo into the empty
[`BHDossantos/Fitnow`](https://github.com/BHDossantos/Fitnow) repo.

It exists here only because the build sandbox cannot push directly to the
Fitnow repo. Once you've completed the steps below, this directory should be
deleted from SavoryMind in a follow-up commit.

## What's inside

The full FitNow project — 371 files, ~4 MB:

- `README.md`, `.gitignore`, `.env.example`, `docker-compose.yml`
- `backend/`, `frontend/`, `database/`, `docs/`, `scripts/`
- `docs/PRODUCT_BRIEF.md` — full product spec
- `.claude/` — GSD (Get Shit Done) install: 85 slash commands, agents,
  hooks, settings (`/gsd-new-project`, `/gsd-plan-phase`, etc.)

No app code yet. Skeleton + GSD only.

## Fan-out from Windows (PowerShell)

Run from `C:\Users\Bruno` (or wherever you keep your repos):

```powershell
# 1. Pull this branch of SavoryMind so you have fitnow-transfer locally
cd C:\Users\Bruno\SavoryMind
git fetch origin
git checkout claude/fitness-platform-naming-f46v0
git pull origin claude/fitness-platform-naming-f46v0

# 2. Clone the empty Fitnow repo as a sibling directory
cd C:\Users\Bruno
git clone https://github.com/BHDossantos/Fitnow.git
cd Fitnow

# 3. Copy everything from fitnow-transfer (including dotfiles like .claude/, .env.example, .gitignore)
robocopy ..\SavoryMind\fitnow-transfer . /E /XD .git
# robocopy returns exit code 1 on success (files copied) — that's fine.

# 4. Initial commit and push
git add -A
git commit -m "chore: initial FitNow skeleton + GSD workflow"
git push -u origin main
```

## After you've pushed

Tell me "transferred" and I'll open a follow-up commit on this branch that
removes `fitnow-transfer/` from SavoryMind, since it's no longer needed.

From there, all FitNow work happens in the Fitnow repo. Open it in Claude
Code and run `/gsd-new-project` to bootstrap the GSD `.planning/` artifacts
from `docs/PRODUCT_BRIEF.md`.
