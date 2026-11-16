"""Exercise the actual probe with a fake curl; no live endpoints or alert writes."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'probe-uptime.sh'
class ProbeTests(unittest.TestCase):
    def probe(self, body='{"status":"ok","db":"ok"}', code='200', rc='0'):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            curl = root / 'curl'
            curl.write_text('''#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
 if [ "$1" = -o ]; then out="$2"; shift 2; else shift; fi
done
printf '%s' "$MOCK_BODY" > "$out"
printf '%s' "$MOCK_CODE"
if [ "$MOCK_RC" != 0 ]; then echo 'mock connection failure' >&2; fi
exit "$MOCK_RC"
''')
            curl.chmod(0o755)
            env = dict(os.environ, PATH=f'{root}:'+os.environ['PATH'], MOCK_BODY=body,
                       MOCK_CODE=code, MOCK_RC=rc, PROBE_RETRY_DELAY='0',
                       WEB_URL='https://web.example', API_URL='https://api.example',
                       API_HEALTH_URL='https://api.example/health',
                       GITHUB_OUTPUT=str(root/'output'), GITHUB_STEP_SUMMARY=str(root/'summary'))
            result = subprocess.run(['bash',str(SCRIPT)],env=env,capture_output=True,text=True)
            self.assertEqual(result.returncode,0, result.stderr)
            return (root/'output').read_text(),result.stdout
    def test_healthy(self):
        output,_=self.probe();self.assertEqual(output,'status=up\n')
    def test_degraded_json_is_not_healthy_even_when_it_contains_ok(self):
        output,_=self.probe('{"status":"degraded","db":"ok"}')
        self.assertIn('status=down',output)
    def test_invalid_json(self):
        output,_=self.probe('<html>ok</html>');self.assertIn('status=down',output)
    def test_transport_diagnostics_survive(self):
        output,log=self.probe(code='000',rc='6')
        self.assertIn('status=down',output);self.assertIn('curl_exit=6 HTTP=000',log)
        self.assertIn('mock connection failure',log)
    def test_http_failure(self):
        output,log=self.probe(code='503');self.assertIn('status=down',output)
        self.assertIn('HTTP=503',log)
if __name__=='__main__': unittest.main()
