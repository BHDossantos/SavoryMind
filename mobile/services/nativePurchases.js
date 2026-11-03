import { Platform } from 'react-native';
import { api } from './api';

let module;
let initialized = false;
let activeIdentity = null;
let queue = Promise.resolve(false);
function sdk() {
  if (module !== undefined) return module;
  try {
    const imported = require('react-native-purchases');
    module = imported.default || imported;
  } catch { module = null; }
  return module;
}
function publicKey() {
  return Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY :
    Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY : null;
}
export function available() { return Boolean(publicKey() && sdk()); }
export function configure(identity) {
  queue = queue.then(async () => {
    if (!identity || !available()) return false;
    if (activeIdentity === identity) return true;
    activeIdentity = null;
    try {
      if (!initialized) {
        sdk().configure({ apiKey: publicKey(), appUserID: identity });
        initialized = true;
      } else { await sdk().logIn(identity); }
      activeIdentity = identity;
      return true;
    } catch { return false; }
  });
  return queue;
}
export async function products(ids) {
  if (!available() || !activeIdentity) return [];
  return sdk().getProducts(ids);
}
export async function purchase(productId, identity) {
  if (!await configure(identity)) throw new Error('Store account could not be prepared. Please sign in again.');
  try { await sdk().purchaseProduct(productId); }
  catch (error) {
    if (error?.userCancelled) return { cancelled: true };
    throw new Error('The store purchase did not complete. Please check your store account before retrying.');
  }
  try { return await api.syncStorePurchases(); }
  catch { throw new Error('Your store purchase completed, but verification is unavailable. Use Restore purchases; do not buy again.'); }
}
export async function restore(identity) {
  if (!await configure(identity)) throw new Error('Store account could not be prepared. Please sign in again.');
  await sdk().restorePurchases();
  // No order ID, token or entitlement from the phone is treated as proof.
  return api.syncStorePurchases();
}
