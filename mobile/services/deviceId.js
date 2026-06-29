// Per-install anonymous identifier used by the public employee-survey
// flow. Persisted in expo-secure-store so a user can scan multiple
// employees over time and the restaurant sees one "unique diner"
// instead of N. Never reported back to the user — it's purely a
// dedup token for the restaurant dashboard.
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY = 'sm_scan_device_id';

export async function getOrCreateDeviceId() {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  // randomUUID is sync; awaiting wouldn't help. Wrapped in a function call
  // to keep the rest of the call site uniformly async.
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, id);
  return id;
}
