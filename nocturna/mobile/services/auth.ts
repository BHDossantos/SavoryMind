import { create } from 'zustand';
import { api, setToken } from './api';

interface AuthState {
  user: any | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  init: async () => {
    try { const u = await api.get<any>('/api/auth/me'); set({ user: u }); } catch { set({ user: null }); }
  },
  login: async (email, password) => {
    const r = await api.post<{ access_token: string }>('/api/auth/login', { email, password });
    await setToken(r.access_token);
    const u = await api.get<any>('/api/auth/me');
    set({ user: u });
  },
  register: async (email, password, name, phone) => {
    const r = await api.post<{ access_token: string }>('/api/auth/register', { email, password, name, phone });
    await setToken(r.access_token);
    const u = await api.get<any>('/api/auth/me');
    set({ user: u });
  },
  logout: async () => { await setToken(null); set({ user: null }); },
}));
