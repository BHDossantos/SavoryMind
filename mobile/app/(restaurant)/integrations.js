import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

export default function IntegrationsScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setStatus(await api.getPosStatus()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const connect = async () => {
    setBusy(true);
    try {
      const { authorize_url } = await api.startSquareConnect();
      await WebBrowser.openBrowserAsync(authorize_url);
      load();
    } catch (e) { Alert.alert(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const s = await api.syncPos();
      Alert.alert(t('integrationsPage.syncDone', { items: s.items, orders: s.orders }));
      load();
    } catch (e) { Alert.alert(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await api.disconnectPos(); load(); } catch (e) { Alert.alert(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingSpinner message="Loading..." color={C.restaurant.primary} />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 60 }}>
      <Text style={styles.title}>{t('integrationsPage.title')}</Text>
      <Text style={styles.subtitle}>{t('integrationsPage.subtitle')}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.logo}><Text style={styles.logoText}>◼</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t('integrationsPage.square')}</Text>
            <Text style={styles.desc}>{t('integrationsPage.squareDesc')}</Text>
          </View>
          <Text style={[styles.badge, status.connected ? styles.badgeOn : styles.badgeOff]}>
            {status.connected ? t('integrationsPage.statusConnected') : t('integrationsPage.statusOff')}
          </Text>
        </View>

        {!status.configured && <Text style={styles.warn}>{t('integrationsPage.notConfigured')}</Text>}

        {status.connected && status.last_sync_stats && (
          <Text style={styles.summary}>
            {t('integrationsPage.syncSummary', {
              items: status.last_sync_stats.items, orders: status.last_sync_stats.orders,
              revenue: status.last_sync_stats.revenue })}
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {!status.connected ? (
            <TouchableOpacity style={[styles.primary, !status.configured && { opacity: 0.5 }]} onPress={connect} disabled={busy || !status.configured}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('integrationsPage.connectSquare')}</Text>}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.primary} onPress={sync} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('integrationsPage.syncNow')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={disconnect} disabled={busy}>
                <Text style={styles.secondaryText}>{t('integrationsPage.disconnect')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <Text style={styles.hint}>{t('integrationsPage.whatItDoes')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:    { fontSize: 24, fontWeight: '800', color: C.gray[900] },
  subtitle: { fontSize: 13, color: C.gray[500], marginTop: 4, marginBottom: 20 },
  card:     { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.gray[100], padding: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo:     { width: 44, height: 44, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 20 },
  name:     { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  desc:     { fontSize: 12, color: C.gray[500], marginTop: 2 },
  badge:    { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badgeOn:  { backgroundColor: '#dcfce7', color: '#166534' },
  badgeOff: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  warn:     { fontSize: 12, color: '#b45309', backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  summary:  { fontSize: 12, color: C.gray[500], marginTop: 10 },
  primary:  { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondary: { borderWidth: 1, borderColor: C.gray[200], borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  secondaryText: { color: C.gray[600], fontWeight: '700', fontSize: 14 },
  hint:     { fontSize: 11, color: C.gray[400], marginTop: 14, lineHeight: 16 },
});
