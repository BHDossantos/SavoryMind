/**
 * Edge-safe NextAuth configuration. Contains only what the middleware needs.
 * Do not import the DB client (lib/db/client.ts) from here — that pulls in
 * the `pg` driver, which uses Node APIs unavailable in the Edge runtime.
 *
 * The Credentials provider's `authorize` lives in auth.ts, which runs on
 * the Node runtime via the [...nextauth] route handler.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // Providers are defined in auth.ts so the edge runtime never sees them.
  providers: [],
  callbacks: {
    async authorized({ auth, request }) {
      const isAuthed = !!auth?.user?.id;
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/deals") ||
        pathname.startsWith("/pipeline") ||
        pathname.startsWith("/compare") ||
        pathname.startsWith("/loi") ||
        pathname.startsWith("/api/deals");
      if (isProtected && !isAuthed) return false;
      return true;
    },
  },
};
