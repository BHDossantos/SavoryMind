import { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../services/api';
import * as purchases from '../services/nativePurchases';
import { useAuth } from '../contexts/AuthContext';

export default function NativeMembership() {
  const { user, updateUser } = useAuth();
  const generation = useRef(0);
  useEffect(() => { generation.current += 1; return () => { generation.current += 1; }; }, [user?.id]);
  const [context, setContext] = useState(null);
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true;
    setMessage('');
    setBusy(false);
    setProducts([]);
    setContext(null);
    void api.getStoreContext().then(async value => {
      if (!alive) return;
      setContext(value);
      if (!value.enabled || !purchases.available()) return;
      if (!await purchases.configure(value.app_user_id)) throw new Error('Store sign-in unavailable');
      const found = await purchases.products(value.products);
      if (alive) setProducts(found.filter(product => /^P[1-9][0-9]*[DWMY]$/.test(product.subscriptionPeriod || '')));
    }).catch(() => { if (alive) setMessage('Store membership could not be loaded. Please try again.'); });
    return () => { alive = false; };
  }, [user?.id]));
  const run = async (productId) => {
    if (!context || busy) return;
    const started = generation.current;
    setBusy(true);
    setMessage('');
    try {
      const result = productId ? await purchases.purchase(productId, context.app_user_id) : await purchases.restore(context.app_user_id);
      if (started !== generation.current || result.cancelled) return;
      setContext(result);
      updateUser({ plan: result.plan });
      setMessage(result.granted ? 'Your store membership is verified.' : 'No active store membership was found. If you just paid, try restoring again shortly.');
    } catch (error) { if (started === generation.current) setMessage(error?.message || 'Verification failed. Please try restoring again.'); }
    finally { if (started === generation.current) setBusy(false); }
  };
  const enabled = context?.enabled && purchases.available();
  return <View style={{ marginVertical: 16 }}>
    {!enabled && <Text>Native store purchases are not configured for this build yet.</Text>}
    {enabled && context.can_purchase && products.map(product => <TouchableOpacity key={product.identifier} accessibilityRole="button" disabled={busy} onPress={() => run(product.identifier)} style={{ paddingVertical: 12 }}>
      <Text>Subscribe: {product.title || product.identifier} — {product.priceString} every {periodLabel(product.subscriptionPeriod)}</Text>
    </TouchableOpacity>)}
    {enabled && <>
      <Text>Subscriptions renew until cancelled in the store where you subscribed. The store confirmation shows the billing period and full terms before you pay.</Text>
      <TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL('https://savorymind.net/legal/terms').catch(() => setMessage('Open savorymind.net/legal/terms to read the terms.')); }}><Text>Terms of use</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL('https://savorymind.net/legal/privacy').catch(() => setMessage('Open savorymind.net/legal/privacy to read the privacy policy.')); }}><Text>Privacy policy</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => run(null)} style={{ paddingVertical: 12 }}><Text>Restore purchases</Text></TouchableOpacity>
    </>}
    {context?.management_url && <TouchableOpacity accessibilityRole="button" onPress={() => { void Linking.openURL(context.management_url).catch(() => setMessage('Open subscriptions in your store account to manage cancellation.')); }}><Text>Manage store subscription</Text></TouchableOpacity>}
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
  </View>;
}

function periodLabel(period) {
  const [, count, unit] = /^P([1-9][0-9]*)([DWMY])$/.exec(period);
  return `${count} ${{ D: 'day', W: 'week', M: 'month', Y: 'year' }[unit]}${count === '1' ? '' : 's'}`;
}
