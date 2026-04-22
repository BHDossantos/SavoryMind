import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api } from "../services/api";

const AuthContext = createContext(null);

function dashboardPath(user) {
  if (!user) return "/login";
  if (!user.onboarding_completed) return "/onboarding";
  if (user.account_type === "consumer") return "/consumer/dashboard";
  if (user.account_type === "diner")    return "/diner/dashboard";
  return "/dashboard";
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // On mount: restore from localStorage, then verify token with backend
  useEffect(() => {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("user");

    if (!token) {
      setLoading(false);
      return;
    }

    // Optimistically restore
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }

    api.getMe()
      .then((fresh) => {
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bridge: when NextAuth session arrives (social login), store backend JWT
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.backendToken) return;

    const currentToken = localStorage.getItem("token");

    // Only act if session has a different/new backend token
    if (session.backendToken !== currentToken) {
      localStorage.setItem("token", session.backendToken);
      localStorage.setItem("user", JSON.stringify(session.backendUser));
      setUser(session.backendUser);
      setLoading(false);

      // Redirect appropriately
      if (session.backendUser && !session.backendUser.onboarding_completed) {
        router.push("/onboarding");
      } else if (session.backendUser) {
        router.push(dashboardPath(session.backendUser));
      }
    }
  }, [session, sessionStatus, router]);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    router.push(dashboardPath(data.user));
  }, [router]);

  const register = useCallback(async (email, password, display_name, account_type) => {
    const data = await api.register({ email, password, display_name, account_type });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    router.push("/onboarding");
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  }, [router]);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, dashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
