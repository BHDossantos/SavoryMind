# Plan 7-3 — First-login import flow

<plan>
  <name>Banner on dashboard imports localStorage deals to the workspace</name>
  <wave>3</wave>
  <depends_on>7-1, 7-2</depends_on>
  <files>
    <write>dealflow/components/ImportLocalBanner.tsx</write>
    <write>dealflow/lib/client/import.ts</write>
    <write>dealflow/lib/client/__test__/import.test.ts</write>
    <write>dealflow/app/page.tsx</write>
  </files>
  <action>
    1. lib/client/import.ts: importLocalDealsToApi(localDeals) — iterates
       and POSTs each to /api/deals, collecting successes and failures.
       Returns { imported: Deal[], failed: { input, error }[] }.
       On a successful import, removes the corresponding localStorage entries.
    2. components/ImportLocalBanner.tsx:
       - Reads dealsRepo.list() from localStorage on mount (only if authed)
       - If > 0, render: "You have N deals saved in this browser. Import to your account?"
       - "Import" button calls importLocalDealsToApi, surfaces a summary
         (toast-ish inline message), refreshes the SWR cache
       - "Dismiss" button hides the banner for this session (sessionStorage flag)
    3. app/page.tsx: mount the banner above the saved-deals section.
       Hide it when authed === false or no local deals.
    4. import.test.ts: mock fetch + window.localStorage; verify all-success
       path clears localStorage; verify partial-failure path keeps failed
       deals in localStorage and reports them.
  </action>
  <verify>
    - npm run build clean
    - import.test.ts green (target +4 tests)
    - Banner only renders when authed && localStorage.deals.length > 0
    - Dismissal persists for the session (sessionStorage)
  </verify>
  <done>
    - Import flow committed
    - Banner is the only place that imports lib/storage in a UI file
  </done>
</plan>
