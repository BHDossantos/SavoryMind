# Audit demo safety and repair booking security

Scope: existing Slotly under SavoryMind feature branch. No migration, merge,
deployment, real payments, outbound messages, account setup or credentials.

1. Close public privilege escalation, unsigned demo webhook and invalid payment transitions.
2. Make demo/live integration modes explicit and block unsafe production configuration.
3. Repair provider approval, service lookup, amount/duration and UTC input handling.
4. Upgrade vulnerable frontend dependencies and adapt dynamic routes; repair redirect and payment status UX, wrap narrow-screen navigation.
5. Verify backend regressions, frontend build/types and npm audit; add CI checks and record unresolved release blockers.

This record reconciles work already underway when the nested CLAUDE.md workflow
instruction was discovered. The bundled GSD quick initializer was run before
this tracking record. No claim that the original edits followed GSD ordering.
