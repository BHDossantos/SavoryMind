# Plan 7-2 — Migrate pages and components to the client layer

<plan>
  <name>Frontend pages and components consume the API via useDealsSource</name>
  <wave>2</wave>
  <depends_on>7-1</depends_on>
  <files>
    <write>dealflow/app/page.tsx</write>
    <write>dealflow/app/deals/new/page.tsx</write>
    <write>dealflow/app/deals/[id]/page.tsx</write>
    <write>dealflow/app/deals/[id]/edit/page.tsx</write>
    <write>dealflow/app/pipeline/page.tsx</write>
    <write>dealflow/app/compare/page.tsx</write>
    <write>dealflow/app/loi/[id]/page.tsx</write>
    <write>dealflow/components/AIAnalysis.tsx</write>
    <write>dealflow/components/Attachments.tsx</write>
  </files>
  <action>
    1. Replace every `dealsRepo.*` call in pages with the corresponding
       action function from lib/client/actions.ts.
    2. Replace local useEffect + window listener pattern with the new
       useDealsSource() / useDealSource(id) hooks.
    3. Pages remain "use client" components for now (no Server Components
       conversion in this phase — out of scope per 7-CONTEXT).
    4. Loading states: dashboard, pipeline, compare show a skeleton card
       block while SWR is loading. Detail / edit pages show "Loading…" if
       useDealSource is still fetching.
    5. seedDemoIfEmpty: only runs for unauthenticated visitors (call it
       in the unauth branch of useDealsSource).
    6. Components (AIAnalysis, Attachments) accept a `refresh` callback
       from the parent (or call `useDealSource(deal.id).refresh()`
       themselves) instead of dispatching window events.
  </action>
  <verify>
    - npm run build clean — every page compiles
    - npm test still green (existing tests unaffected — pure functions only)
    - All 8+ page/component files no longer import lib/storage in their
      body (allowed only in unauthenticated-fallback code path)
    - Type-check passes: every page either consumes Deal[] from the new
      hook or DealInput in the form
  </verify>
  <done>
    - lib/storage.ts is still present (it's the unauthenticated fallback)
    - But it is no longer imported directly by any UI file
    - Pages render correctly against an empty SWR cache + auth=none
  </done>
</plan>
