# Plan 6-2 — NextAuth credentials + signup/login pages

<plan>
  <name>Authentication: NextAuth v5 + signup + login + middleware</name>
  <wave>2</wave>
  <depends_on>6-1 (DB schema + users-repo)</depends_on>
  <files>
    <write>dealflow/auth.ts</write>
    <write>dealflow/app/api/auth/[...nextauth]/route.ts</write>
    <write>dealflow/app/api/auth/signup/route.ts</write>
    <write>dealflow/middleware.ts</write>
    <write>dealflow/app/login/page.tsx</write>
    <write>dealflow/app/signup/page.tsx</write>
    <write>dealflow/lib/auth/server.ts</write>
    <write>dealflow/lib/auth/__test__/signup.test.ts</write>
    <write>dealflow/app/layout.tsx</write>
  </files>
  <action>
    1. auth.ts: NextAuth v5 config — Drizzle adapter + Credentials provider
       calling users-repo.verifyPassword. JWT session strategy. Custom pages
       (/login, /signup).
    2. app/api/auth/[...nextauth]/route.ts: re-export handlers.
    3. app/api/auth/signup/route.ts: validates email/password, hashes,
       calls users-repo.createUserWithDefaultWorkspace, returns 201.
       Rejects duplicate email with 409.
    4. middleware.ts: protect /deals, /pipeline, /compare, /loi, /api/deals.
       Unauthenticated requests to UI pages redirect to /login?from=...
       Unauthenticated API requests get 401 JSON.
    5. /login and /signup pages: minimal forms styled with existing Tailwind
       classes (input, btn-primary, card). Client-side fetch; on success
       redirect to dashboard.
    6. Header in app/layout.tsx: show "Log in" / "Sign up" when unauth,
       user email + "Sign out" when auth. Use `auth()` server helper.
    7. lib/auth/server.ts: small helper requireSession() that throws 401
       if no session — used by API route handlers.
    8. signup.test.ts: signup creates user + workspace; duplicate email
       returns 409; password hashed (cost >= 10).
  </action>
  <verify>
    - Build passes (`npm run build`)
    - signup.test.ts green
    - /login and /signup pages render in dev (visual smoke — documented in summary)
    - Hitting /deals while logged out redirects to /login
    - Existing tests still green (28 + new)
  </verify>
  <done>
    - Auth wired end-to-end
    - Signup creates user + default workspace transactionally
    - Middleware enforces auth on protected paths
  </done>
</plan>
