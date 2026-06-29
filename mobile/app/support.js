/**
 * Help / FAQ — parity with frontend/src/pages/support.js.
 *
 * Reached from the More screen on any account type. Apple's App Review
 * specifically asks for a clear support contact in-app — this is it.
 */
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';

function mailto(addr) { Linking.openURL(`mailto:${addr}`).catch(() => {}); }

export default function SupportScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>← {t('supportPage.home')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('supportPage.title')}</Text>
      <Text style={styles.subtitle}>{t('supportPage.subtitle')}</Text>

      <Text style={styles.h2}>{t('supportPage.contactHeader')}</Text>
      <Text style={styles.body}>{t('supportPage.contactBody')}</Text>

      <View style={styles.contactRow}>
        <TouchableOpacity style={styles.contactCard} onPress={() => mailto('hello@savorymind.net')}>
          <Text style={styles.contactLabel}>{t('supportPage.generalHelp')}</Text>
          <Text style={styles.contactEmail}>hello@savorymind.net</Text>
          <Text style={styles.contactDesc}>{t('supportPage.generalHelpDesc')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactCard} onPress={() => mailto('privacy@savorymind.net')}>
          <Text style={styles.contactLabel}>{t('supportPage.privacyTitle')}</Text>
          <Text style={styles.contactEmail}>privacy@savorymind.net</Text>
          <Text style={styles.contactDesc}>{t('supportPage.privacyDesc')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.h2}>{t('supportPage.faqHeader')}</Text>
      {[1, 2, 3, 5, 6].map((n) => (
        <View key={n} style={{ marginBottom: 14 }}>
          <Text style={styles.faqQ}>{t(`supportPage.q${n}`)}</Text>
          <Text style={styles.faqA}>{t(`supportPage.a${n}`)}</Text>
        </View>
      ))}
      <View style={{ marginBottom: 14 }}>
        <Text style={styles.faqQ}>{t('supportPage.q4')}</Text>
        <Text style={styles.faqA}>
          {t('supportPage.a4Prefix')}{' '}
          <Text style={styles.link} onPress={() => mailto('privacy@savorymind.net')}>privacy@savorymind.net</Text>
          {' '}{t('supportPage.a4Suffix')}
        </Text>
      </View>

      <Text style={styles.h2}>{t('supportPage.statusHeader')}</Text>
      <Text style={styles.body}>{t('supportPage.statusBody')}</Text>

      <Text style={styles.h2}>{t('supportPage.otherLinks')}</Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://savorymind.net/legal/privacy')}>
        <Text style={styles.link}>{t('supportPage.privacyLink')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('https://savorymind.net/legal/terms')}>
        <Text style={[styles.link, { marginTop: 6 }]}>{t('supportPage.termsLink')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back:        { fontSize: 13, color: C.gray[500], marginBottom: 16 },
  title:       { fontSize: 26, fontWeight: '800', color: C.gray[900] },
  subtitle:    { fontSize: 13, color: C.gray[500], marginTop: 4, marginBottom: 24 },
  h2:          { fontSize: 17, fontWeight: '700', color: C.gray[900], marginTop: 12, marginBottom: 8 },
  body:        { fontSize: 14, color: C.gray[700], lineHeight: 20, marginBottom: 14 },
  contactRow:  { gap: 10, marginBottom: 20 },
  contactCard: { borderColor: C.gray[200], borderWidth: 1, borderRadius: 12, padding: 14 },
  contactLabel:{ fontSize: 11, color: C.gray[500], textTransform: 'uppercase', fontWeight: '700' },
  contactEmail:{ fontSize: 16, color: '#2563eb', marginTop: 6, fontWeight: '600' },
  contactDesc: { fontSize: 13, color: C.gray[600], marginTop: 6 },
  faqQ:        { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  faqA:        { fontSize: 13, color: C.gray[600], marginTop: 4, lineHeight: 19 },
  link:        { color: '#2563eb', fontSize: 13 },
});
