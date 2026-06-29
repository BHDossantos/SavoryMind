import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore, setUnauthenticatedHandler } from '../services/api';
import { identify, reset as resetAnalytics } from '../services/analytics';
import { applyServerLanguage } from '../services/i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wire the api-layer "session is dead" callback so /me / any-screen
    // 401 with no usable refresh boots the user back to the login flow.
    setUnauthenticatedHandler(() => setUser(null));

    // Restore session: presence of an access token + a successful /me
    // call. If access is expired, request() will transparently call
    // /auth/refresh first and retry, so this single call covers both
    // the "still fresh" and "rotation needed" paths.
    tokenStore.getAccess()
      .then((token) => {
        if (!token) return null;
        return api.getMe();
      })
      .then((me) => { if (me) setUser(me); })
      .catch(async () => {
        await tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Sync identity to PostHog whenever the active user changes. Privacy-
  // safe traits only — never email/name (those stay on the backend's
  // identify() call). No-op when EXPO_PUBLIC_POSTHOG_KEY is unset.
  useEffect(() => {
    if (user?.id) {
      identify(user.id, { account_type: user.account_type });
    }
  }, [user?.id, user?.account_type]);

  // Honor the server-stored language preference. Runs every time
  // user.language changes — covers fresh login, hydrate-from-token,
  // and the Profile screen flipping the language picker. No-ops on
  // logout (user becomes null).
  useEffect(() => {
    if (user?.language) {
      applyServerLanguage(user.language);
    }
  }, [user?.language]);

  const login = async (email, password) => {
    // api.login() saves both access + refresh tokens into SecureStore
    // (the result body now carries refresh_token because we send
    // X-Client-Type: mobile). The user we display comes straight from the
    // login response — no need for an extra /me round-trip.
    const result = await api.login({ email, password });
    setUser(result.user);
    return result.user;
  };

  const register = async (data) => {
    const result = await api.register(data);
    setUser(result.user);
    return result.user;
  };

  // Native Google sign-in (commit "wire mobile expo-auth-session"). The
  // login/signup screens hand over the id_token from expo-auth-session's
  // Google provider; api.googleLogin saves the access + refresh tokens
  // to SecureStore, we just sync the user into context.
  const loginGoogle = async (idToken) => {
    const result = await api.googleLogin(idToken);
    setUser(result.user);
    return result.user;
  };

  // Native Sign in with Apple (iOS only). Required by App Store Review
  // Guideline 4.8 because we offer Google sign-in. The login screen
  // calls expo-apple-authentication's signInAsync() and passes the
  // identity token + name + email here. Backend api.appleLogin verifies
  // the token via Apple's JWKS, mints a SavoryMind session, and the
  // returned user gets synced into context — same shape as Google.
  const loginApple = async ({ idToken, name, email }) => {
    const result = await api.appleLogin({ idToken, name, email });
    setUser(result.user);
    return result.user;
  };

  // socialLogin / loginSocial were removed — see comment in services/api.js
  // for the migration plan (expo-auth-session + a backend bridge route,
  // not yet wired up).

  const logout = async () => {
    // Calls /auth/logout to revoke the refresh token's jti server-side,
    // then wipes SecureStore. Order matters: revocation needs the refresh
    // token still in storage when api.logout() reads it.
    await api.logout();
    setUser(null);
    // Reset analytics distinct_id so a shared-device handoff doesn't
    // attribute the next user's events to the previous session. No-op
    // when EXPO_PUBLIC_POSTHOG_KEY is unset.
    try { await resetAnalytics(); } catch {}
  };

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginGoogle, loginApple, logout, setUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
