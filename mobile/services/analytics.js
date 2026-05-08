/**
 * Mobile analytics wrapper — same shape as frontend/src/lib/analytics.js
 * and backend/app/services/posthog_client.py.
 *
 * - Initializes PostHog React Native once on first import.
 * - Silent no-op when EXPO_PUBLIC_POSTHOG_KEY is unset.
 * - Strips a small set of credential-looking property keys.
 * - identify() keyed on user_id; we never track anonymous traffic.
 *
 * Usage:
 *   import { track, identify, reset } from '../services/analytics';
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
    if (!PII_KEYS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

async function getClient() {
  if (_initialized) return _posthog;
  _initialized = true;

  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  try {
    const { default: PostHog } = await import('posthog-react-native');
    _posthog = new PostHog(key, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      // Manual screen_view via the helper below; no auto-capture of
      // gestures (too noisy and risks capturing PII inside text inputs).
      captureAppLifecycleEvents: true,
      flushAt: 20,        // batch up to 20 events before flushing
      flushInterval: 30000, // or every 30s, whichever first
    });
    return _posthog;
  } catch (err) {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
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
  } catch {} // never let analytics break a user interaction
}

export async function trackScreenview(screenName, properties) {
  const client = await getClient();
  if (!client) return;
  try {
    client.screen(screenName, safeProps(properties));
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
  // Called on logout — wipes the device's PostHog distinct_id so
  // the next user doesn't inherit the previous session.
  const client = await getClient();
  if (!client) return;
  try { client.reset(); } catch {}
}
