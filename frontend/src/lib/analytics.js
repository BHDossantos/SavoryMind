/**
 * Frontend analytics wrapper — same shape as the backend's posthog_client.
 *
 * - Initializes PostHog once on first import (browser only, never SSR).
 * - Silent no-op when NEXT_PUBLIC_POSTHOG_KEY is unset (events
 *   discarded; nothing throws). Same pattern as Sentry-no-DSN.
 * - Strips a small set of credential-looking property keys before
 *   forwarding (defense-in-depth — call sites shouldn't pass these,
 *   but if they do, the wrapper drops them).
 * - identify() is keyed on user_id; we never capture anonymous traffic
 *   beyond raw page_view. Privacy policy disclosure stays in sync.
 *
 * Usage:
 *   import { track, identify, reset } from '../lib/analytics';
 *   track('event_name', { property: 'value' });
 */

let _posthog = null;
let _initialized = false;

const PII_KEYS = new Set([
  'password', 'token', 'access_token', 'refresh_token',
  'id_token', 'secret', 'api_key', 'authorization',
]);

function safeProps(props) {
  if (!props) return {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (!PII_KEYS.has(k.toLowerCase())) {
      out[k] = v;
    }
  }
  return out;
}

async function getClient() {
  if (typeof window === 'undefined') return null; // SSR — no events
  if (_initialized) return _posthog;
  _initialized = true;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  try {
    // Lazy-load — avoids paying the bundle cost when analytics is unset.
    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      // Don't autocapture every click — too noisy for our use case. We
      // explicitly track the events that matter via track() calls.
      autocapture: false,
      // capture_pageview is handled manually in _app.js routeChangeComplete
      // so we get the post-replace path rather than the pre-replace one.
      capture_pageview: false,
      capture_pageleave: true,
    });
    _posthog = posthog;
    return posthog;
  } catch (err) {
    // SDK not installed or init failed — degrade silently.
    if (typeof console !== 'undefined') {
      console.info('analytics: posthog disabled —', err?.name || 'unknown');
    }
    return null;
  }
}

export async function track(event, properties) {
  const client = await getClient();
  if (!client) return;
  try {
    client.capture(event, safeProps(properties));
  } catch {} // never let analytics break a page interaction
}

export async function trackPageview(path) {
  const client = await getClient();
  if (!client) return;
  try {
    client.capture('$pageview', { $current_url: path });
  } catch {}
}

export async function identify(userId, traits) {
  const client = await getClient();
  if (!client || !userId) return;
  try {
    client.identify(String(userId), safeProps(traits));
  } catch {}
}

export async function reset() {
  // Called on logout — clears the local PostHog distinct_id so the
  // next user on the same device doesn't inherit the previous one's
  // session.
  const client = await getClient();
  if (!client) return;
  try { client.reset(); } catch {}
}
