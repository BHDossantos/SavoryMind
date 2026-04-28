import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const BASE = (Constants?.expoConfig?.extra as any)?.apiUrl || 'http://localhost:8001';

async function token() {
  try { return await SecureStore.getItemAsync('nocturna.token'); } catch { return null; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  const t = await token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(data?.detail || res.statusText), { status: res.status, data });
  return data as T;
}

export const api = {
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T,>(p: string) => request<T>(p, { method: 'DELETE' }),
};

export async function setToken(t: string | null) {
  if (t) await SecureStore.setItemAsync('nocturna.token', t);
  else await SecureStore.deleteItemAsync('nocturna.token');
}
