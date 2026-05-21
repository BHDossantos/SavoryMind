import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api, setAccessToken, setUnauthenticatedHandler } from "../services/api";

const AuthContext = createContext(null);

function dashboardPath(user) {
  if (!user) return "/login";
  if (user.account_type === "staff") return "/staff-portal";
  if (!user.onboarding_completed) return "/onboarding";
  if (user.account_type === "consumer") return "/consumer/dashboard";
  if (user.account_type === "diner")    return "/diner/dashboard";
  return "/dashboard";
}

// Cached user profile lives in localStorage purely for instant UX on reload —
// it's the same data /auth/me returns and contains nothing security-sensitive.
// The actual auth secret (refresh token) is in an httpOnly cookie that JS
// cannot read; the access token lives in memory only.
const USER_CACHE_KEY = "user";

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const bridgedSessionRef = useRef(null);

  // On mount: try the httpOnly refresh cookie. If it works, we're logged in.
  // Optimistically render with cached user data so the app doesn't flash to
  // the login screen during the refresh round-trip.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      try { localStorage.removeItem(USER_CACHE_KEY); } catch {}
      setUser(null);
      if (typeof window !== "undefined") window.location.href = "/login";
    });

    let cached = null;
    try {
      const raw = localStorage.getItem(USER_CACHE_KEY);
      if (raw) cached = JSON.parse(raw);
    } catch {}

    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    api.refresh()
      .then((data) => {
        // Race guard: don't downgrade onboarding_completed from true → false.
        // handleNext can flip it locally, then a stale refresh callback could
        // overwrite with the older false value.
        let fresh = data.user;
        if (cached?.onboarding_completed && !fresh.onboarding_completed) {
          fresh = { ...fresh, onboarding_completed: true };
        }
        setUser(fresh);
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(fresh)); } catch {}
      })
      .catch(() => {
        // No valid refresh cookie → not logged in
        try { localStorage.removeItem(USER_CACHE_KEY); } catch {}
        setUser(null);
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bridge: when NextAuth session arrives (social OAuth completed), exchange
  // it for a backend session via the server-side bridge route. The bridge
  // sets the httpOnly refresh cookie on this browser and returns the
  // short-lived access token for in-memory storage.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session || !session.oauthProfile) return;

    // De-dupe: useSession can fire multiple times with the same session
    const fingerprint = `${session.oauthProfile.provider}:${session.oauthProfile.provider_id}`;
    if (bridgedSessionRef.current === fingerprint) return;
    bridgedSessionRef.current = fingerprint;

    (async () => {
      try {
        const res = await fetch("/api/auth/social-bridge", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Social bridge returned ${res.status}`);
        }
        const data = await res.json();
        setAccessToken(data.access_token);
        setUser(data.user);
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user)); } catch {}
        setLoading(false);

        if (data.user && !data.user.onboarding_completed) {
          router.push("/onboarding");
        } else if (data.user) {
          router.push(dashboardPath(data.user));
        }
      } catch (err) {
        console.error("Social login bridge failed:", err);
        setLoading(false);
      }
    })();
  }, [session, sessionStatus, router]);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    setAccessToken(data.access_token);
    setUser(data.user);
    try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user)); } catch {}
    router.push(dashboardPath(data.user));
  }, [router]);

  const register = useCallback(async (email, password, display_name, account_type) => {
    const data = await api.register({ email, password, display_name, account_type });
    setAccessToken(data.access_token);
    setUser(data.user);
    try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user)); } catch {}
    router.push("/onboarding");
  }, [router]);

  const logout = useCallback(async () => {
    // Clear server-side cookie first so a stolen client can't re-refresh.
    try { await api.logout(); } catch {}
    setAccessToken(null);
    setUser(null);
    try { localStorage.removeItem(USER_CACHE_KEY); } catch {}
    // Reset PostHog distinct_id so the next user on this device doesn't
    // inherit the previous one's analytics session. No-op when analytics
    // unconfigured.
    try {
      const { reset } = await import("../lib/analytics");
      await reset();
    } catch {}
    router.push("/login");
  }, [router]);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Entitlement gate for the consumer Premium paywall. `plan` rides along on
  // every /auth/me + /auth/refresh response, so this is accurate without an
  // extra request — <PremiumGate> and the upgrade page both read it.
  const isPremium = (user?.plan || "free") === "premium";

  return (
    <AuthContext.Provider value={{ user, loading, isPremium, login, register, logout, updateUser, dashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
