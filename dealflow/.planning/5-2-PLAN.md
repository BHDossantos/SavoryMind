# Plan 5-2 — CSV export + LOI generator tests

<plan>
  <name>Coverage for csv.ts and loi.ts</name>
  <wave>2</wave>
  <depends_on>5-1 (Vitest infra)</depends_on>
  <files>
    <write>dealflow/lib/csv.test.ts</write>
    <write>dealflow/lib/loi.test.ts</write>
  </files>
  <action>
    1. csv.test.ts:
       - Reuse fixtures from lib/__fixtures__/deals.ts; promote to Deal by adding id/status/etc.
       - Assert header row matches the documented column order exactly.
       - Assert that values containing commas, quotes, and newlines are properly escaped.
       - Assert risk_flags column is "severity:code; severity:code" formatted.
    2. loi.test.ts:
       - defaultLoiInput() returns a valid ISO date 60 days from now.
       - generateLoi() output contains: deal name, suggested offer in EUR formatting,
         section 6 (financing contingency) only when toggle is true, exclusivity clause,
         non-binding clause, signature lines.
       - Buyer name omission falls back to the placeholder line.
  </action>
  <verify>
    - `npm test` includes both new files
    - csv: header order assertion locks the public schema
    - csv: at least one fixture has a quote, a comma, and a newline embedded in `notes`
    - loi: snapshot-free assertions (substring match) so cosmetic edits to whitespace
      don't break the test
  </verify>
  <done>
    - dealsToCsv covered for happy path + escaping
    - generateLoi covered for both financing-contingency states + missing buyer name
  </done>
</plan>
