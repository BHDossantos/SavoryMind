#!/usr/bin/env python3
"""Pre-deploy preflight: validates that every secret the deploy workflow
references actually exists in the repo's GitHub Actions secrets, and that
the obvious value-coupling rules hold.

Usage:
    python scripts/preflight.py
    python scripts/preflight.py --strict  # exit 1 even on warnings

Requires the `gh` CLI to be installed and authenticated against the
SavoryMind repo. Never reads secret VALUES — only existence and naming.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Secrets that must exist for the production deploy to succeed. These are
# checked at lifespan startup time, so missing them = backend won't boot.
REQUIRED_SECRETS = {
    "GCP_SA_KEY":           "Service account JSON for the deploy step. Without it the workflow can't authenticate to gcloud.",
    "SECRET_KEY":           "JWT signing secret. Lifespan refuses to boot in prod if it's the dev default.",
    "SOCIAL_LOGIN_SECRET":  "Web NextAuth bridge → backend social-login. Same fail-loud guard as SECRET_KEY.",
    "TOKEN_ENCRYPTION_KEY": "Fernet key encrypting OAuth tokens at rest. Lifespan refuses to boot if unset / dev-default.",
    "ANTHROPIC_API_KEY":    "Claude API. Without it, AI features cleanly degrade to rules-based fallbacks.",
    "CLOUD_SQL_PASSWORD":   "Postgres root credential.",
}

# Secrets that are optional — features just stay dormant when missing.
OPTIONAL_SECRETS = {
    "SPOTIFY_CLIENT_ID":     "Spotify OAuth. /api/oauth/spotify/* returns 503 if unset.",
    "SPOTIFY_CLIENT_SECRET": "Pair with the above.",
    "GOOGLE_CLIENT_ID":      "Native Google sign-in. /api/auth/google returns 503 if unset.",
    "SENTRY_DSN":            "Error reporting. SDK no-ops if unset.",
    "RESEND_API_KEY":        "Transactional email. Service skips sends if unset.",
}


# ── Helpers ──────────────────────────────────────────────────────────────


class Issue:
    def __init__(self, level: str, secret: str, msg: str):
        self.level = level  # "error" or "warning"
        self.secret = secret
        self.msg = msg

    def __str__(self) -> str:
        prefix = "✗" if self.level == "error" else "⚠"
        return f"  {prefix} {self.secret}: {self.msg}"


def _gh_secret_names() -> set[str]:
    """Returns the set of secret names defined in the repo's Actions
    secrets. Raises SystemExit if `gh` isn't available or auth'd."""
    try:
        out = subprocess.run(
            ["gh", "secret", "list"],
            capture_output=True, text=True, check=True, cwd=REPO_ROOT,
        )
    except FileNotFoundError:
        sys.exit("error: `gh` CLI not found. Install via https://cli.github.com")
    except subprocess.CalledProcessError as e:
        sys.exit(f"error: `gh secret list` failed.\n{e.stderr or e.stdout}")
    # gh secret list output is tab-separated: NAME\tUPDATED. Take col 0.
    return {line.split("\t", 1)[0].strip() for line in out.stdout.splitlines() if line.strip()}


def _workflow_secret_refs(path: Path) -> set[str]:
    """Extract every `secrets.X` reference from a workflow YAML file."""
    text = path.read_text(encoding="utf-8")
    return set(re.findall(r"secrets\.([A-Z_][A-Z0-9_]*)", text))


def _workflow_envvar_keys(path: Path) -> set[str]:
    """Extract the env-var keys passed to gcloud run deploy via the
    --set-env-vars flag. Lets us cross-check that every secret reference
    actually flows into the container."""
    text = path.read_text(encoding="utf-8")
    keys: set[str] = set()
    for match in re.finditer(r"--set-env-vars\s+\"([^\"]+)\"", text):
        body = match.group(1)
        # The deploy uses the ^|^ delimiter form: ^|^KEY=VAL|KEY=VAL|...
        if body.startswith("^|^"):
            body = body[3:]
        for pair in body.split("|"):
            if "=" in pair:
                keys.add(pair.split("=", 1)[0].strip())
    return keys


# ── Checks ───────────────────────────────────────────────────────────────


def check_required_secrets(present: set[str]) -> list[Issue]:
    issues: list[Issue] = []
    for name, why in REQUIRED_SECRETS.items():
        if name not in present:
            issues.append(Issue("error", name, f"REQUIRED but not set in Actions secrets — {why}"))
    return issues


def check_optional_secrets(present: set[str]) -> list[Issue]:
    issues: list[Issue] = []
    for name, why in OPTIONAL_SECRETS.items():
        if name not in present:
            issues.append(Issue("warning", name, f"optional, not set — feature dormant. {why}"))
    return issues


def check_workflow_refs(present: set[str], deploy_yml: Path) -> list[Issue]:
    """Every secret referenced in the deploy workflow MUST exist in
    Actions. Catches typos like SPOTIFY_CLIENT_KEY vs SPOTIFY_CLIENT_SECRET."""
    issues: list[Issue] = []
    refs = _workflow_secret_refs(deploy_yml)
    for ref in sorted(refs):
        if ref not in present:
            issues.append(Issue(
                "error", ref,
                f"referenced in {deploy_yml.relative_to(REPO_ROOT)} but doesn't exist as an Actions secret.",
            ))
    return issues


def check_envvar_plumbing(deploy_yml: Path) -> list[Issue]:
    """Every secret-loaded env var that the workflow declares (via the
    `env:` block) should be present on the gcloud run deploy --set-env-vars
    line. A common bug: add a new GitHub secret + workflow `env:` entry
    but forget to plumb it into Cloud Run, so the secret loads on the
    runner but never reaches the container."""
    issues: list[Issue] = []
    text = deploy_yml.read_text(encoding="utf-8")
    # Find env-block secret bindings: NAME: ${{ secrets.X }}
    env_keys = set(re.findall(r"^\s+([A-Z_][A-Z0-9_]*):\s*\$\{\{\s*secrets\.", text, flags=re.MULTILINE))
    deployed = _workflow_envvar_keys(deploy_yml)
    for key in sorted(env_keys):
        if key not in deployed:
            issues.append(Issue(
                "warning", key,
                "loaded from Actions secrets in the env: block but not passed to "
                "gcloud run deploy --set-env-vars — it'll be set on the runner but not "
                "in the container.",
            ))
    return issues


# ── Entrypoint ───────────────────────────────────────────────────────────


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--strict", action="store_true", help="Exit 1 even when only warnings are present.")
    args = p.parse_args()

    deploy_yml = REPO_ROOT / ".github" / "workflows" / "deploy-backend.yml"
    if not deploy_yml.exists():
        sys.exit(f"error: {deploy_yml} not found — run from the repo root.")

    print("→ Querying Actions secrets via `gh secret list`…")
    present = _gh_secret_names()
    print(f"  Found {len(present)} secrets.")

    all_issues: list[Issue] = []
    all_issues.extend(check_required_secrets(present))
    all_issues.extend(check_workflow_refs(present, deploy_yml))
    all_issues.extend(check_envvar_plumbing(deploy_yml))
    all_issues.extend(check_optional_secrets(present))

    errors   = [i for i in all_issues if i.level == "error"]
    warnings = [i for i in all_issues if i.level == "warning"]

    if errors:
        print(f"\n{len(errors)} blocking issue(s):")
        for i in errors:
            print(i)

    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for i in warnings:
            print(i)

    if not all_issues:
        print("\n✓ All preflight checks pass. Safe to merge + deploy.")
        return 0

    if errors:
        print("\n✗ Preflight FAILED — fix the blocking issues before deploying.")
        return 1

    print("\n✓ No blocking issues. Warnings above are informational.")
    return 1 if args.strict else 0


if __name__ == "__main__":
    sys.exit(main())
