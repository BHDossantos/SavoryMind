import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore, setUnauthenticatedHandler } from '../services/api';

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

  // socialLogin / loginSocial were removed — see comment in services/api.js
  // for the migration plan (expo-auth-session + a backend bridge route,
  // not yet wired up).

  const logout = async () => {
    // Calls /auth/logout to revoke the refresh token's jti server-side,
    // then wipes SecureStore. Order matters: revocation needs the refresh
    // token still in storage when api.logout() reads it.
    await api.logout();
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginGoogle, logout, setUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
