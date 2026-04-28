'use client';
// Tiny PostHog wrapper. No-op when NEXT_PUBLIC_POSTHOG_KEY is unset, so the
// app stays usable without analytics in dev or when the user opts out.

import type { PostHog } from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

let client: PostHog | null = null;
let initStarted = false;

async function ensure(): Promise<PostHog | null> {
  if (typeof window === 'undefined') return null;
  if (!KEY) return null;
  if (client) return client;
  if (initStarted) return null;
  initStarted = true;
  const mod = await import('posthog-js');
  const ph = mod.default;
  ph.init(KEY, {
    api_host: HOST,
    capture_pageview: false,            // we send our own
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
  });
  client = ph as unknown as PostHog;
  return client;
}

export async function capture(event: string, props?: Record<string, any>) {
  const ph = await ensure();
  if (!ph) return;
  ph.capture(event, props);
}

export async function pageview(path?: string) {
  const ph = await ensure();
  if (!ph) return;
  ph.capture('$pageview', { $current_url: path || (typeof location !== 'undefined' ? location.href : undefined) });
}

export async function identify(userId: string | number, traits?: Record<string, any>) {
  const ph = await ensure();
  if (!ph) return;
  ph.identify(String(userId), traits);
}

export async function reset() {
  const ph = await ensure();
  if (!ph) return;
  ph.reset();
}

export const isAnalyticsEnabled = !!KEY;
