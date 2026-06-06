# This repository

This repository contains two distinct projects. Active development is on **DealFlow AI**.

## DealFlow AI (active) — `dealflow/`

A web platform that helps small-business buyers find, analyze, score, negotiate, and track acquisitions (restaurants, gyms, bars, salons, retail, services). Turns raw financials into a deterministic deal score plus an AI-generated investment thesis and negotiation playbook in seconds.

See `dealflow/README.md` for tech stack, run instructions, and feature list. Planning artifacts live under `dealflow/.planning/`.

**Status:** Active. Phase 5 (tested scoring engine) shipped; Phase 6 (backend foundation) in flight.

## SavoryMind (legacy) — `frontend/`, `backend/`, `mobile/`, `database/`, `scripts/`

An earlier AI-powered restaurant analytics product. Code remains in this repository for reference but is unmaintained. Do not develop against it. New work happens under `dealflow/`.

The Cloud Build pipeline, Dockerfile, and `.github/workflows/deploy-*.yml` workflows at the repository root belong to SavoryMind and will be retired or replaced when DealFlow ships its own production infrastructure (Phase 9).

## Repository layout

```
.
├─ dealflow/                Active product (DealFlow AI)
├─ frontend/                Legacy (SavoryMind)
├─ backend/                 Legacy (SavoryMind)
├─ mobile/                  Legacy (SavoryMind)
├─ database/                Legacy (SavoryMind)
├─ scripts/                 Legacy (SavoryMind)
└─ .github/workflows/
   ├─ dealflow-tests.yml    Active — DealFlow CI
   └─ deploy-*.yml          Legacy — SavoryMind CI
```
