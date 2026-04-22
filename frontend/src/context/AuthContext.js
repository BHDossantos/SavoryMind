import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
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
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount: restore cached user then verify the token is still valid on the server
  useEffect(() => {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("user");

    if (!token) { setLoading(false); return; }

    // Optimistically restore so the UI doesn't flash
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }

    // Verify token against backend and refresh user data
    api.getMe()
      .then((fresh) => {
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      })
      .catch(() => {
        // Token is invalid/expired — clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    router.push("/onboarding"); // Always go through onboarding after signup
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
