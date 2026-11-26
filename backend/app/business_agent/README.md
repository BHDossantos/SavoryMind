# Business agent (ported from Jennifer)

This folder is Jennifer's agent core, ported to Python so this app can run the same business agent Jennifer runs. Source: github.com/BHDossantos/jennifer. Change it there first, then copy it here again.

- `core.py`: the department agents, Jennifer's agent rules, the strict output envelope and `run_business_task`, which works one business task the way Jennifer's department shift does.
- `charter.py`: this business's agent, with its tasks, guardrails, measures and the daily Claude routine it works alongside.
- `untrusted.py`, `redaction.py`, `claims.py`: Jennifer's guards. Outside text is wrapped as untrusted data. Secrets are redacted from errors. Claims that something was paid, sent or signed are flagged.

The agent can only propose. Nothing here sends, posts, pays or writes. Every proposal comes back with `"needsApproval": True`.

## Turning it on

`provider.py` wires the agent to Claude and `app/api/routes/admin_business_agent.py` exposes it to the `ADMIN_EMAILS` allowlist only (everyone else gets a 403, as with the pilots view).

1. Set `ANTHROPIC_API_KEY` and `ADMIN_EMAILS` on the server.
2. Set `BUSINESS_AGENT_ENABLED=true`. Without it the run route answers 503 with the reason, and nothing calls the model.
3. `GET /api/admin/business-agent` shows the charter. `POST /api/admin/business-agent/run` with `{"taskId": "prospects", "notes": "..."}` runs one task on the restaurant account counts plus any notes, and returns the proposals. The model sees counts only, never names or contact details. Nothing is stored or sent.

`BUSINESS_AGENT_MODEL` overrides the model.
