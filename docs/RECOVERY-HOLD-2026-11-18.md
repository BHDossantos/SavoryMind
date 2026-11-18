# SavoryMind recovery checkpoint — 18 November 2026

## Code blocker addressed

The November 11 dependency update changed only `expo` from SDK 55 to SDK 58
while Router, React Native, Babel and Jest stayed on SDK 55. Restore SDK 55 with
its supported native module families, including localization, and regenerate the
lockfile. Keep patched React 19.2.5 and its matching test renderer. Remove the
unsupported legacy-architecture option. CI now checks dependency families before
bundle/native compilation so an isolated future SDK major bump fails explicitly.
React DOM and the test renderer are pinned to the same patched React version to
prevent npm 10 peer-resolution failures. The frontend lockfile repair from PR #168
is included without its feature changes: main still pins Tailwind 4 despite
requiring Tailwind 3.

## Production hold — no restart or deploy performed

The coordinator reports Render workspace confirmation is pending and historical
hosted SQLite data must be preserved. The checked-in Blueprint is desired state,
not proof of the live database or disk configuration. Local HTTP probes were
blocked by the environment proxy; the public website was readable through web
fetch, but neither API health URL could be verified through that tool. Do not
interpret that tooling failure as a new application status measurement.

Minimum recovery sequence after authorized hosting access is confirmed:

1. Read the live Render service, active deployment commit, custom-domain mapping,
   event history and database/storage configuration. Compare the canonical API
   and direct provider health from an authorized probe. Preserve the intentional
   Render migration; do not redirect DNS to another platform.
2. Identify every existing SQLite database and journal/WAL file and the actual
   configured database engine without exposing credentials. Before restart,
   capture a transaction-consistent backup (SQLite online backup API or equivalent),
   record a checksum and store it durably with restricted access. Verify restoration
   on an isolated copy and reconcile record counts and key account/billing data.
   A raw copy of only the main file while WAL writes continue is insufficient.
3. Verify the durable target database and backups; plan and test data reconciliation
   and schema migration on a restored copy. `backend/main.py` applies migrations
   at startup and stamps an unversioned existing `users` schema as head, so inspect
   the real schema and Alembic revision rather than trusting the stamp or SELECT 1.
4. Verify existing signing/social-login/encryption keys remain stable. Current
   `validate_runtime` rejects hosted SQLite and missing/default keys before startup;
   retain that guard. Do not deploy this candidate into an unverified runtime or
   rotate keys to make a check pass. Keep scheduler/outreach and payment gates intact.
5. Only after data reconciliation, backup/restore proof and required checks pass,
   deploy the approved exact commit with rollback evidence, then verify canonical
   API health and the authorized core user flows. Root HTTP 200 alone is insufficient.

Native release additionally needs successful native compilation, signed-device
acceptance, store billing configuration and review/submission evidence. JavaScript
bundle success is not an App Store or Play release. No signed build or submission
was performed by this repair branch.
