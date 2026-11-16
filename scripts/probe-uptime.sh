#!/usr/bin/env bash
# Probe only: no issue mutations, credentials, or provider operations.
set -eu
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
fails=''
check() {
  local name="$1" url="$2" health="${3:-false}" code rc attempt
  for attempt in 1 2 3; do
    rc=0
    code=$(curl -sS --connect-timeout 10 --max-time 40 -o "$work/body" -w '%{http_code}' "$url" 2>"$work/error") || rc=$?
    if [ "$rc" -eq 0 ] && [ "$code" = 200 ]; then
      if [ "$health" = false ] || python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if isinstance(d,dict) and d.get("status")=="ok" and d.get("db")=="ok" else 1)' "$work/body" 2>/dev/null; then
        echo "PASS: $name HTTP 200"
        return 0
      fi
      echo "FAIL: $name attempt $attempt: HTTP 200 but invalid/degraded health JSON"
    else
      echo "FAIL: $name attempt $attempt: curl_exit=$rc HTTP=${code:-none}"
      # Preserve transport diagnostics; never print response bodies.
      head -c 1000 "$work/error"
      echo
    fi
    if [ "$attempt" -lt 3 ]; then sleep "${PROBE_RETRY_DELAY:-15}"; fi
  done
  fails="${fails}${name}: curl_exit=$rc HTTP=${code:-none}; endpoint or health contract failed"$'\n'
  return 1
}
check Web "$WEB_URL" || true
check API "$API_URL" || true
check 'API+DB health' "$API_HEALTH_URL" true || true
if [ -n "$fails" ]; then
  echo 'status=down' >> "$GITHUB_OUTPUT"
  { echo 'detail<<PROBE_DETAIL'; printf '%s' "$fails"; echo PROBE_DETAIL; } >> "$GITHUB_OUTPUT"
else
  echo 'status=up' >> "$GITHUB_OUTPUT"
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  { echo '## Endpoint checks'; if [ -n "$fails" ]; then printf '%s' "$fails"; else echo 'All endpoints passed, including API and database health.'; fi; } >> "$GITHUB_STEP_SUMMARY"
fi
# Let existing alert/recovery steps run; the workflow reports failure afterward.
