import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db/client";
import {
  findDefaultWorkspaceId,
  verifyCredentials,
} from "@/lib/db/users-repo";

// Defer the production-secret check to first request, not module eval —
// otherwise `next build`'s page-data collection trips it.
const AUTH_SECRET = process.env.AUTH_SECRET ?? "dev-only-not-for-production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: AUTH_SECRET,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const email = String(credentials.email ?? "").trim().toLowerCase();
        const password = String(credentials.password ?? "");
        if (!email || !password) return null;
        const user = await verifyCredentials(db(), email, password);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        const ws = await findDefaultWorkspaceId(db(), user.id);
        (token as Record<string, unknown>).workspaceId = ws;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.workspaceId =
          ((token as Record<string, unknown>).workspaceId as string | null) ??
          null;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      workspaceId: string | null;
    };
  }
}

