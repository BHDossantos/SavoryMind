'use client';
import { create } from 'zustand';
import { api, setToken } from './api';
import type { UserProfile } from '../../../shared/types';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string, name?: string, phone?: string) => Promise<UserProfile>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: async () => {
    try {
      const u = await api.get<UserProfile>('/api/auth/me');
      set({ user: u, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const r = await api.post<{ access_token: string; user_id: number; email: string; role: string; name?: string }>(
      '/api/auth/login',
      { email, password },
    );
    setToken(r.access_token);
    const u = await api.get<UserProfile>('/api/auth/me');
    set({ user: u });
    return u;
  },
  register: async (email, password, name, phone) => {
    const r = await api.post<{ access_token: string }>('/api/auth/register', { email, password, name, phone });
    setToken(r.access_token);
    const u = await api.get<UserProfile>('/api/auth/me');
    set({ user: u });
    return u;
  },
  logout: () => { setToken(null); set({ user: null }); },
}));
