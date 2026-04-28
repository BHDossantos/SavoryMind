'use client';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nocturna.token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
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

export function setToken(t: string | null) {
  if (typeof window === 'undefined') return;
  if (t) localStorage.setItem('nocturna.token', t);
  else localStorage.removeItem('nocturna.token');
}

export function getToken() { return token(); }
