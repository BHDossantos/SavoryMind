/**
 * Restaurant Stripe billing — parity with frontend/src/pages/restaurant/billing.js
 *
 * €99/mo "pro" plan. Native opens Stripe Checkout / Portal in expo-web-browser
 * (Apple/Google policies forbid native checkout for web subscriptions, but a
 * browser tab is allowed for an existing service). On return the screen
 * polls for the subscription_status webhook to land server-side.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';

const PRICE_LABEL = '€99';
const PRICE_PERIOD = '/mo';
const FEATURES = ['bookings', 'alerts', 'intelligence', 'link'];

export default function RestaurantBillingScreen() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getRestaurantBillingStatus();
      setStatus(s);
      if (s.is_pro && user?.plan !== 'pro') updateUser({ plan: 'pro' });
      return s;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [user, updateUser]);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []); // eslint-disable-line
  // Re-poll when the screen comes back into focus (returning from browser).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // After return from Checkout, the webhook can lag — poll briefly so the
  // screen resolves itself within a few seconds.
  const startSync = () => {
    if (syncing) return;
    setSyncing(true);
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const s = await refresh();
      if ((s && s.is_pro) || tries >= 5) {
        clearInterval(timer);
        setSyncing(false);
      }
    }, 2500);
  };

  const openInBrowser = async (url) => {
    // Apple/Google: opening a browser to manage an existing web subscription
    // is permitted. Use AuthSession-style open so the user returns to the
    // app cleanly when they finish in Stripe.
    await WebBrowser.openBrowserAsync(url);
  };

  const startCheckout = async () => {
    setActionLoading(true); setError(null);
    try {
      const { url } = await api.createRestaurantCheckout();
      await openInBrowser(url);
      startSync();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  const openPortal = async () => {
    setActionLoading(true); setError(null);
    try {
      const { url } = await api.createRestaurantPortal();
      await openInBrowser(url);
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  if (loading) return <LoadingSpinner message={t('common.loading')} color={C.restaurant.primary} />;

  const pro = (status && status.is_pro) || user?.plan === 'pro';
  const billingLive = status?.billing_configured;
  const trialDays = status?.trial_days || 0;
  const periodEnd = status?.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString(i18n.language)
    : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 60 }}>
      <Text style={styles.title}>{t('restaurantBillingPage.title')}</Text>
      <Text style={styles.subtitle}>{t('restaurantBillingPage.subtitle')}</Text>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {pro ? (
        <View style={styles.proCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 28 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.proHeadline}>{t('restaurantBillingPage.onPlan')}</Text>
              <Text style={styles.proSub}>
                {status?.subscription_status === 'trialing'
                  ? `${t('restaurantBillingPage.trialActive')}${periodEnd ? ' ' + t('restaurantBillingPage.trialEnds', { date: periodEnd }) : ''}`
                  : `${t('restaurantBillingPage.subActive')}${periodEnd ? ' ' + t('restaurantBillingPage.renews', { date: periodEnd }) : ''}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={openPortal} disabled={actionLoading}>
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>{t('restaurantBillingPage.manageSub')}</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>{t('restaurantBillingPage.manageHint')}</Text>
        </View>
      ) : (
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeHeader}>
            <Text style={styles.upgradeLabel}>{t('restaurantBillingPage.planLabel')}</Text>
            {trialDays > 0 && <Text style={styles.upgradeTrial}>{t('restaurantBillingPage.trialThen', { days: trialDays })}</Text>}
            <Text style={styles.upgradePrice}>
              {PRICE_LABEL}<Text style={styles.upgradePeriod}>{PRICE_PERIOD}</Text>
            </Text>
          </View>
          <View style={{ padding: 18 }}>
            {FEATURES.map((k) => (
              <View key={k} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{ICONS[k]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{t(`restaurantBillingPage.feat_${k}`)}</Text>
                  <Text style={styles.featureDesc}>{t(`restaurantBillingPage.feat_${k}_desc`)}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.primaryBtn, !billingLive && { opacity: 0.5 }]}
              onPress={startCheckout}
              disabled={actionLoading || !billingLive}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>
                    {trialDays > 0
                      ? t('restaurantBillingPage.startTrial', { days: trialDays })
                      : t('restaurantBillingPage.subscribeCta', { price: PRICE_LABEL, period: PRICE_PERIOD })}
                  </Text>}
            </TouchableOpacity>
            {!billingLive && <Text style={styles.warn}>{t('restaurantBillingPage.billingOff')}</Text>}
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 8 }]}>{t('restaurantBillingPage.secureFootnote')}</Text>
          </View>
        </View>
      )}

      {syncing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <ActivityIndicator color={C.restaurant.primary} />
          <Text style={{ fontSize: 12, color: C.gray[500] }}>{t('restaurantBillingPage.successActivating')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const ICONS = { bookings: '📅', alerts: '🔔', intelligence: '📊', link: '🔗' };

const styles = StyleSheet.create({
  title:        { fontSize: 24, fontWeight: '800', color: C.gray[900] },
  subtitle:     { fontSize: 13, color: C.gray[500], marginTop: 4, marginBottom: 20 },
  errorBox:     { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText:    { color: '#b91c1c', fontSize: 13 },
  proCard:      { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#fed7aa', padding: 18 },
  proHeadline:  { fontSize: 16, fontWeight: '700', color: C.gray[900] },
  proSub:       { fontSize: 12, color: C.gray[500], marginTop: 2 },
  primaryBtn:   { backgroundColor: '#ea580c', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  hint:         { fontSize: 11, color: C.gray[400], marginTop: 8 },
  upgradeCard:  { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#fed7aa', overflow: 'hidden' },
  upgradeHeader:{ backgroundColor: '#9a3412', padding: 20 },
  upgradeLabel: { color: '#fed7aa', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  upgradeTrial: { color: '#fed7aa', fontSize: 12, fontWeight: '700', marginTop: 4 },
  upgradePrice: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  upgradePeriod:{ color: '#fed7aa', fontSize: 14, fontWeight: '500' },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  featureIcon:  { fontSize: 20 },
  featureTitle: { fontSize: 13, fontWeight: '700', color: C.gray[900] },
  featureDesc:  { fontSize: 11, color: C.gray[500], marginTop: 2 },
  warn:         { color: '#b45309', fontSize: 11, textAlign: 'center', marginTop: 6 },
});
