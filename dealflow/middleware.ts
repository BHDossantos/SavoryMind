import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe NextAuth instance — no DB driver imported transitively.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    "/deals/:path*",
    "/pipeline",
    "/compare",
    "/loi/:path*",
    "/api/deals/:path*",
  ],
};
