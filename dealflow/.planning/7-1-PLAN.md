# Plan 7-1 — Client data layer + SWR

<plan>
  <name>Async data layer: API client, action layer, useDealsSource hook</name>
  <wave>1</wave>
  <depends_on>Phase 6</depends_on>
  <files>
    <write>dealflow/package.json</write>
    <write>dealflow/lib/client/api.ts</write>
    <write>dealflow/lib/client/actions.ts</write>
    <write>dealflow/lib/client/use-deals.ts</write>
    <write>dealflow/lib/client/__test__/api.test.ts</write>
    <write>dealflow/components/Providers.tsx</write>
  </files>
  <action>
    1. Add `swr` (^2.x) to dependencies.
    2. lib/client/api.ts: typed fetch wrappers around /api/deals — listDeals,
       getDeal, createDeal, updateDeal, deleteDeal. Each returns the
       canonical Deal type; throws DealApiError with status + message on
       non-2xx. Encapsulates JSON serialization and error parsing.
    3. lib/client/actions.ts: branch-on-authed action functions —
       createDealAction(authed, input), updateDealAction(authed, id, patch),
       deleteDealAction(authed, id), setStatusAction(authed, id, status),
       setPriorityAction(authed, id, priority), setNarrativeAction(authed, id, narrative),
       addAttachmentAction(authed, id, attachment),
       removeAttachmentAction(authed, id, attachmentId). When authed: call API.
       When not: delegate to lib/storage.ts.
    4. lib/client/use-deals.ts: hooks. useDealsSource() returns
       { deals, isLoading, error, refresh, authed }. useDealSource(id)
       returns the same shape for a single deal. Backed by SWR when authed;
       useState + dealflow:change event subscription when not.
    5. components/Providers.tsx: add SWRConfig at the top with
       { revalidateOnFocus: true, dedupingInterval: 2000 }.
    6. lib/client/__test__/api.test.ts: mock global.fetch and assert that
       listDeals parses { deals: [...] }, createDeal POSTs the right body,
       errors throw with the body's error message.
  </action>
  <verify>
    - npm run build clean
    - npm test green including new api.test.ts (target +6 tests)
    - useDealsSource hook compiles under strict TS
    - No page yet calls the new hook (that's Plan 7-2)
  </verify>
  <done>
    - lib/client/* exists and compiles
    - SWRConfig wraps the app
    - API client tests passing
  </done>
</plan>
