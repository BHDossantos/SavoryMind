import { getServerSession } from "next-auth/next";
import { authOptions } from "./[...nextauth]";

// Server-side bridge between NextAuth (which holds the OAuth profile in the
// Next.js JWT session) and the SavoryMind backend (which mints the access +
// refresh tokens). We do the call here instead of in NextAuth's `jwt`
// callback so that the backend's Set-Cookie header flows through to the
// user's browser instead of being trapped on the Next.js server.
//
// The social-secret check on the backend is preserved — the secret never
// leaves this server, so a malicious client can't mint backend tokens by
// calling /api/auth/social directly with a fabricated profile.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const SOCIAL_SECRET = process.env.SOCIAL_LOGIN_SECRET || "dev-social-secret";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.oauthProfile) {
    return res.status(401).json({ error: "No active OAuth session." });
  }

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/social`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-social-secret": SOCIAL_SECRET,
      },
      body: JSON.stringify(session.oauthProfile),
    });
  } catch (err) {
    return res.status(502).json({ error: "Backend unreachable." });
  }

  // Forward Set-Cookie headers verbatim so the refresh cookie's Domain,
  // Path, HttpOnly, Secure and SameSite attributes set by the backend take
  // effect on the user's browser. Node's response object accepts an array.
  // raw() is needed because getHeader collapses duplicate Set-Cookie entries.
  const setCookie = backendRes.headers.raw
    ? backendRes.headers.raw()["set-cookie"]
    : backendRes.headers.get("set-cookie");
  if (setCookie) {
    res.setHeader("Set-Cookie", setCookie);
  }

  const text = await backendRes.text();
  res.status(backendRes.status);
  res.setHeader("Content-Type", "application/json");
  return res.send(text);
}
