import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tokenStore.get()
      .then((token) => {
        if (!token) { setLoading(false); return null; }
        return api.getMe();
      })
      .then((me) => { if (me) setUser(me); })
      .catch(() => {
        tokenStore.remove();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const result = await api.login({ email, password });
    const me = await api.getMe();
    setUser(me);
    return me;
  };

  const register = async (data) => {
    await api.register(data);
    await api.login({ email: data.email, password: data.password });
    const me = await api.getMe();
    setUser(me);
    return me;
  };

  // Called after successful OAuth — provider already called api.socialLogin()
  const loginSocial = async ({ provider, provider_id, email, name, avatar_url }) => {
    const result = await api.socialLogin({ provider, provider_id, email, name, avatar_url });
    setUser(result.user);
    return result.user;
  };

  const logout = async () => {
    await tokenStore.remove();
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginSocial, logout, setUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
