/**
 * Server-only API helpers.
 *
 * Used by Server Components, generateMetadata, sitemap.ts, etc. Honours
 * NEXT_PUBLIC_API_URL (browser-facing) and falls back to BACKEND_URL
 * (server-only override, useful when the backend is reachable on a
 * private hostname inside the cluster but the browser uses a public one).
 */

const API = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export async function apiServer<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    next: { revalidate: 60 },
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${res.statusText}`), { status: res.status });
  return res.json() as Promise<T>;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nocturna.app';
export const SITE_NAME = 'Nocturna';
