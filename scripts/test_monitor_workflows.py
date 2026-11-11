"""Exercise monitor shell steps offline; never call GitHub, Slack or a live API.

Run with `python scripts/test_monitor_workflows.py` (standard library only).
The command doubles verify repository context, alert deduplication and fail-fast
behavior. GitHub itself validates workflow/expression syntax on the PR.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
MONITOR = (ROOT / ".github/workflows/uptime-monitor.yml").read_text()
DEPLOY = (ROOT / ".github/workflows/render-deploy.yml").read_text()


def shell_steps(source: str) -> dict[str, str]:
    """Read this workflow's named literal run blocks without a YAML dependency."""
    result: dict[str, str] = {}
    name = None
    lines = source.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("      - name: "):
            name = line.split("name: ", 1)[1]
        if line == "        run: |":
            block = []
            for following in lines[i + 1:]:
                if following and not following.startswith("          "):
                    break
                block.append(following[10:] if following else "")
            if not name:
                raise AssertionError("Unnamed run block")
            result[name] = "\n".join(block) + "\n"
    return result


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name)
        self.log = self.work / "calls.jsonl"
        self.env = {
            **os.environ,
            "PATH": str(self.work) + os.pathsep + os.environ["PATH"],
            "GH_REPO": "BHDossantos/SavoryMind",
            "GH_TOKEN": "offline-test-placeholder",
            "CALL_LOG": str(self.log),
            "ISSUE_LABEL": "uptime-down",
            "OWNER_HANDLE": "BHDossantos",
            "DETAIL": "API endpoint failed",
            "SLACK_WEBHOOK_URL": "",
            "EXISTING": "",
            "LOOKUP_FAIL": "",
            "LABELS": "uptime-down",
            "LABEL_LOOKUP_FAIL": "",
            "GITHUB_OUTPUT": str(self.work / "outputs"),
            "WEB_URL": "https://web.invalid/",
            "API_URL": "https://api.invalid/",
            "API_HEALTH_URL": "https://api.invalid/health",
            "BAD_URL": "",
        }
        self.stub("gh", '''
            import json, os, sys
            args = sys.argv[1:]
            with open(os.environ["CALL_LOG"], "a") as f:
                f.write(json.dumps(args) + "\\n")
            if os.environ.get("GH_REPO") != "BHDossantos/SavoryMind":
                sys.exit("Repository context missing")
            if args[:2] == ["label", "list"]:
                if os.environ.get("LABEL_LOOKUP_FAIL"):
                    print("label lookup denied", file=sys.stderr)
                    sys.exit(43)
                print(os.environ.get("LABELS", ""))
            elif args[:2] == ["issue", "list"]:
                if os.environ.get("LOOKUP_FAIL"):
                    print("lookup denied", file=sys.stderr)
                    sys.exit(42)
                print(os.environ.get("EXISTING", ""))
            elif args[:2] not in (["label", "create"], ["issue", "create"], ["issue", "comment"], ["issue", "close"]):
                sys.exit("Unexpected GitHub command")
        ''')
        self.stub("curl", '''
            import os, sys
            if any(arg in ("-X", "--request") for arg in sys.argv):
                sys.exit("Unexpected external write")
            url = sys.argv[-1]
            if url == os.environ.get("BAD_URL"):
                print("connection failed\\n000")
                sys.exit(7)
            print('{"status":"ok","db":"ok"}\\n200')
        ''')
        self.stub("sleep", "pass")

    def stub(self, name: str, code: str):
        path = self.work / name
        path.write_text("#!/usr/bin/env python3\n" + textwrap.dedent(code))
        path.chmod(0o700)

    def run_step(self, name: str, **values):
        env = {**self.env, **values}
        return subprocess.run(
            ["bash", "-e"], input=shell_steps(MONITOR)[name], text=True,
            env=env, cwd=self.work, capture_output=True, timeout=10,
        )

    def calls(self):
        return [json.loads(line)[:2] for line in self.log.read_text().splitlines()]

    def test_explicit_repository_and_shell_syntax(self):
        self.assertIn("  GH_REPO: ${{ github.repository }}", MONITOR)
        self.assertIn("concurrency:\n  group: uptime-monitor\n  cancel-in-progress: false", MONITOR)
        steps = shell_steps(MONITOR)
        self.assertEqual(len(steps), 3)
        for script in steps.values():
            result = subprocess.run(["bash", "-n"], input=script, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_outage_creates_one_issue(self):
        result = self.run_step("Open / update alert issue")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [["label", "list"], ["issue", "list"], ["issue", "create"]])

    def test_missing_label_is_created_before_issue(self):
        result = self.run_step("Open / update alert issue", LABELS="uptime-down-other")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [["label", "list"], ["label", "create"], ["issue", "list"], ["issue", "create"]])

    def test_label_lookup_failure_stops_writes(self):
        result = self.run_step("Open / update alert issue", LABEL_LOOKUP_FAIL="1")
        self.assertEqual(result.returncode, 43)
        self.assertIn("label lookup denied", result.stderr)
        self.assertEqual(self.calls(), [["label", "list"]])

    def test_existing_outage_does_not_duplicate(self):
        result = self.run_step("Open / update alert issue", EXISTING="17")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [["label", "list"], ["issue", "list"]])

    def test_recovery_comments_then_closes(self):
        result = self.run_step("Resolve alert issue on recovery", EXISTING="17")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [["issue", "list"], ["issue", "comment"], ["issue", "close"]])

    def test_recovery_without_issue_is_read_only(self):
        result = self.run_step("Resolve alert issue on recovery")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [["issue", "list"]])

    def test_lookup_errors_are_visible_and_stop_writes(self):
        for name in ("Open / update alert issue", "Resolve alert issue on recovery"):
            with self.subTest(step=name):
                self.log.unlink(missing_ok=True)
                result = self.run_step(name, LOOKUP_FAIL="1")
                self.assertEqual(result.returncode, 42)
                self.assertIn("lookup denied", result.stderr)
                expected = [["label", "list"], ["issue", "list"]] if name.startswith("Open") else [["issue", "list"]]
                self.assertEqual(self.calls(), expected)

    def test_probe_healthy(self):
        result = self.run_step("Probe endpoints (with retries to avoid false alarms)")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(self.env["GITHUB_OUTPUT"]).read_text(), "status=up\n")

    def test_probe_failure_sets_down_without_running_alert(self):
        result = self.run_step("Probe endpoints (with retries to avoid false alarms)", BAD_URL=self.env["API_URL"])
        self.assertEqual(result.returncode, 0, result.stderr)
        output = Path(self.env["GITHUB_OUTPUT"]).read_text()
        self.assertIn("status=down", output)
        self.assertIn("API (api.savorymind.net) is unreachable", output)
        self.assertFalse(self.log.exists())

    def test_deploy_hook_respects_native_skip_phrases(self):
        phrases = ["[skip render]", "[render skip]", "[skip deploy]", "[deploy skip]", "[skip cd]", "[cd skip]"]
        block = re.search(r"    if: >-\n((?:      .*\n)+)", DEPLOY)
        self.assertIsNotNone(block)
        condition = " ".join(block.group(1).split())
        expected = "${{ github.event.workflow_run.conclusion == 'success' && "
        expected += " && ".join("!contains(github.event.workflow_run.head_commit.message, '" + p + "')" for p in phrases)
        expected += " }}"
        self.assertEqual(condition, expected)
        # GitHub contains() is case-insensitive. Exercise the exact predicate
        # above, including success, failure and all documented skip markers.
        should_deploy = lambda conclusion, message: conclusion == "success" and not any(p in message.lower() for p in phrases)
        self.assertTrue(should_deploy("success", "fix: application behavior"))
        for conclusion in ("failure", "cancelled", "skipped"):
            self.assertFalse(should_deploy(conclusion, "fix: application behavior"))
        for phrase in phrases:
            self.assertFalse(should_deploy("success", "fix: monitor " + phrase))
            self.assertFalse(should_deploy("success", "fix: monitor " + phrase.upper()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
