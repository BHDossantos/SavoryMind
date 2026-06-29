/**
 * Snap-a-Menu — "Order like a local, anywhere." Native surface.
 *
 * This is where native earns its keep over web: one tap opens the real
 * camera (expo-image-picker), the photo is captured at controlled
 * quality, and the AI's pick comes back in seconds. Library pick is
 * offered too — people often already photographed the menu.
 *
 * The picker is asked for quality 0.5 — menus are high-contrast text,
 * so aggressive JPEG compression doesn't hurt legibility and keeps the
 * upload ~300-600KB on modern phone cameras.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Share, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { track } from '../../services/analytics';

const PICKER_OPTS = {
  mediaTypes: ['images'],
  quality: 0.5,
  allowsEditing: false,
};

export default function MenuSnapScreen() {
  const { t, i18n } = useTranslation();
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);

  const snap = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('menuSnapScreen.permTitle'), t('menuSnapScreen.permBody'));
      return;
    }
    const res = await ImagePicker.launchCameraAsync(PICKER_OPTS);
    if (!res.canceled && res.assets?.[0]?.uri) {
      setImageUri(res.assets[0].uri);
      setResult(null); setError(null);
      track('wedge_menu_photo_picked', { method: 'camera', platform: 'mobile' });
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync(PICKER_OPTS);
    if (!res.canceled && res.assets?.[0]?.uri) {
      setImageUri(res.assets[0].uri);
      setResult(null); setError(null);
      track('wedge_menu_photo_picked', { method: 'library', platform: 'mobile' });
    }
  };

  const submit = async () => {
    if (!imageUri) return;
    setLoading(true); setError(null);
    try {
      const res = await api.snapMenu(imageUri, { language: i18n.language });
      setResult(res.recommendation);
      track('wedge_menu_completed', { source: res.source, platform: 'mobile' });
    } catch (e) {
      setError(e.message || t('menuSnapScreen.errGeneric'));
      track('wedge_menu_failed', { platform: 'mobile' });
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `${result.share_title}\n\n— SavoryMind\nhttps://savorymind.net/s?t=${encodeURIComponent(result.share_title || "")}`,
      });
      track('wedge_menu_shared', { method: 'native', platform: 'mobile' });
    } catch {}
  };

  const reset = () => {
    setImageUri(null); setResult(null); setError(null);
  };

  if (result) {
    return (
      <SafeScreen>
        <Text style={styles.eyebrow}>SavoryMind</Text>
        <Text style={styles.dishTitle}>{result.dish}</Text>
        <Text style={styles.shareSubtitle}>{result.share_title}</Text>

        <View style={styles.resultCard}>
          <View style={styles.resultHero}>
            <Text style={styles.resultLabelLight}>{t('menuSnapScreen.whyHeader')}</Text>
            <Text style={styles.resultWhy}>{result.why}</Text>
          </View>
          {result.alternatives?.length > 0 && (
            <View style={styles.resultBody}>
              <Text style={styles.resultLabel}>{t('menuSnapScreen.alsoConsider')}</Text>
              {result.alternatives.map((a) => (
                <Text key={a} style={styles.altItem}>• {a}</Text>
              ))}
            </View>
          )}
          {result.warnings?.length > 0 && (
            <View style={styles.warnBlock}>
              <Text style={styles.warnLabel}>⚠ {t('menuSnapScreen.heads')}</Text>
              {result.warnings.map((w) => (
                <Text key={w} style={styles.warnItem}>{w}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>✨ {t('menuSnapScreen.share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.againBtn} onPress={reset} activeOpacity={0.85}>
            <Text style={styles.againBtnText}>📸 {t('menuSnapScreen.another')}</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <Text style={styles.eyebrow}>SavoryMind</Text>
      <Text style={styles.title}>{t('menuSnapScreen.tagline')}</Text>
      <Text style={styles.subtitle}>{t('menuSnapScreen.subtagline')}</Text>

      {imageUri ? (
        <View>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          <TouchableOpacity onPress={reset}>
            <Text style={styles.retake}>← {t('menuSnapScreen.retake')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickCard} onPress={snap} activeOpacity={0.85} testID="snap-camera">
            <Text style={styles.pickEmoji}>📸</Text>
            <Text style={styles.pickLabel}>{t('menuSnapScreen.camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickCard} onPress={pick} activeOpacity={0.85} testID="snap-library">
            <Text style={styles.pickEmoji}>🖼️</Text>
            <Text style={styles.pickLabel}>{t('menuSnapScreen.library')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {imageUri && (
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>{t('menuSnapScreen.tellMe')}</Text>}
        </TouchableOpacity>
      )}
    </SafeScreen>
  );
}

const AMBER = '#d97706';
const AMBER_LIGHT = '#fffbeb';

const styles = StyleSheet.create({
  eyebrow:       { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: AMBER, textAlign: 'center', marginBottom: 6 },
  title:         { fontSize: 26, fontWeight: '800', color: C.gray[900], textAlign: 'center', lineHeight: 33 },
  subtitle:      { fontSize: 13, color: C.gray[500], textAlign: 'center', marginTop: 8, marginBottom: 22, lineHeight: 19 },
  pickRow:       { flexDirection: 'row', gap: 12 },
  pickCard:      { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#fcd34d', backgroundColor: AMBER_LIGHT, borderRadius: 20, paddingVertical: 34, alignItems: 'center' },
  pickEmoji:     { fontSize: 40, marginBottom: 8 },
  pickLabel:     { fontSize: 13, fontWeight: '700', color: '#92400e' },
  preview:       { width: '100%', height: 320, borderRadius: 16, backgroundColor: C.gray[100] },
  retake:        { fontSize: 13, color: C.gray[500], marginTop: 10 },
  error:         { color: '#dc2626', fontSize: 13, textAlign: 'center', marginTop: 14 },
  submitBtn:     { backgroundColor: AMBER, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  submitBtnDisabled:{ opacity: 0.6 },
  submitText:    { color: '#fff', fontSize: 15, fontWeight: '800' },

  dishTitle:     { fontSize: 26, fontWeight: '800', color: C.gray[900], textAlign: 'center', lineHeight: 32, marginTop: 4 },
  shareSubtitle: { fontSize: 13, color: C.gray[500], textAlign: 'center', marginTop: 8, marginBottom: 20 },
  resultCard:    { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fff' },
  resultHero:    { backgroundColor: AMBER, padding: 20 },
  resultLabelLight:{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  resultWhy:     { fontSize: 15, color: '#fff', lineHeight: 22 },
  resultBody:    { padding: 20 },
  resultLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: C.gray[500], marginBottom: 8 },
  altItem:       { fontSize: 14, color: C.gray[800], marginBottom: 4 },
  warnBlock:     { backgroundColor: AMBER_LIGHT, padding: 20, borderTopWidth: 1, borderTopColor: '#fde68a' },
  warnLabel:     { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#92400e', marginBottom: 6 },
  warnItem:      { fontSize: 13, color: '#78350f', lineHeight: 19 },
  actionRow:     { flexDirection: 'row', gap: 10, marginTop: 16 },
  shareBtn:      { flex: 1, backgroundColor: AMBER, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  shareBtnText:  { color: '#fff', fontSize: 14, fontWeight: '800' },
  againBtn:      { flex: 1, borderWidth: 1.5, borderColor: C.gray[200], paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#fff' },
  againBtnText:  { color: C.gray[700], fontSize: 14, fontWeight: '700' },
});
