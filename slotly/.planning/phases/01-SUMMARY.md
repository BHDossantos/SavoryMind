# Phase 01 — End-to-end booking loop (v0 scaffold)

**Status:** done
**Commit:** `e926bfc` (under former name `availablenow`)
**Date:** 2026-04-28

## Goal

Make the smallest credible booking loop work, end to end: signup → provider profile + services + availability → customer search → book → cancel.

## Outcome

- 24 backend routes spread across 6 routers (auth, providers, services, availability, search, appointments)
- 11 frontend pages (landing, search, provider profile, booking, my appointments, login, signup, provider dashboard + profile + services + availability)
- Slot computation engine (`availability_engine.py`) that excludes working-hours edges, blocked time, and existing bookings
- Search with category + city + "available now" filter (≤2h horizon)
- Booking with double-book protection (HTTP 409)
- Cancellation by customer or provider
- Seed: 10 Rome barbers across 8 neighborhoods + 1 demo customer

## Decisions logged

- D-01 (single repo), D-02 (SQLite default), D-03 (JWT auth), D-04 ("Available now" as default search)

## Verified

End-to-end: login → search (10 results) → service → 50 open slots → book → list → double-book rejected with 409 → cancel → slot freed. Frontend `next build` clean.

## What was deferred

Reviews, deposits, admin, notifications.
