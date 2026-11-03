import { Platform } from 'react-native';
import { api, tokenStore } from './api';

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
function exclusive(work) {
  const result = queue.then(work, work);
  queue = result.then(() => undefined, () => undefined);
  return result;
}
async function configureNow(identity) {
  if (!identity || !available()) return false;
  if (activeIdentity === identity) return true;
  activeIdentity = null;
  try {
    if (!initialized) { sdk().configure({ apiKey: publicKey(), appUserID: identity }); initialized = true; }
    else { await sdk().logIn(identity); }
    activeIdentity = identity;
    return true;
  } catch { return false; }
}
export function configure(identity) { return exclusive(() => configureNow(identity)); }
async function forAccount(identity, work) {
  const token = await tokenStore.getAccess();
  return exclusive(async () => {
    if (!token || token !== await tokenStore.getAccess() || !await configureNow(identity)) throw new Error('Sign into the purchasing account and restore; do not buy again.');
    if (token !== await tokenStore.getAccess()) throw new Error('Account changed. Sign into the purchasing account and restore; do not buy again.');
    const result = await work();
    if (result?.cancelled) return result;
    if (token !== await tokenStore.getAccess()) throw new Error('Account changed. Sign into the purchasing account and restore; do not buy again.');
    return api.syncStorePurchases(token);
  });
}
export async function products(ids) {
  if (!available() || !activeIdentity) return [];
  return sdk().getProducts(ids);
}
export function purchase(productId, identity) {
  return forAccount(identity, async () => {
    try { await sdk().purchaseProduct(productId); }
    catch (error) {
      if (error?.userCancelled) return { cancelled: true };
      throw new Error('The store purchase did not complete. Check the purchasing store account before retrying.');
    }
  }).catch(error => { throw new Error(error?.message?.includes('Account changed') || error?.message?.includes('Sign into') ? error.message : 'Purchase verification failed. Sign into the purchasing account and Restore purchases; do not buy again.'); });
}
export function restore(identity) {
  return forAccount(identity, () => sdk().restorePurchases());
}
