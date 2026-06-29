// Survey form screen — receives the scanned QR token, fetches the
// survey definition + employee/restaurant names, renders the form,
// and submits. Public flow (no auth needed), but the same screen
// works for logged-in diners scanning from inside the app.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { C } from '../../constants/colors';
import { api } from '../../services/api';
import { getOrCreateDeviceId } from '../../services/deviceId';


function StarRow({ value, onChange }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[styles.starBtn, filled && styles.starBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.starText, filled && styles.starTextActive]}>★</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


function YesNoRow({ value, onChange, yesLabel, noLabel }) {
  return (
    <View style={styles.yesNoRow}>
      <TouchableOpacity
        onPress={() => onChange(true)}
        style={[styles.yesNoBtn, value === true && styles.yesNoBtnActive]}
      >
        <Text style={[styles.yesNoText, value === true && styles.yesNoTextActive]}>{yesLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange(false)}
        style={[styles.yesNoBtn, value === false && styles.yesNoBtnActive]}
      >
        <Text style={[styles.yesNoText, value === false && styles.yesNoTextActive]}>{noLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}


export default function SurveyForm() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getEmployeeSurvey(token)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((e) => setState({ status: 'error', data: null, error: e.message }));
  }, [token]);

  const updateAnswer = (qid, value) => setAnswers((a) => ({ ...a, [qid]: value }));

  const handleSubmit = async () => {
    setSubmitError(null);
    const required = state.data.survey.questions.filter((q) => q.required);
    for (const q of required) {
      const v = answers[q.id];
      if (v === undefined || v === null || v === '') {
        setSubmitError(t('scan.requiredField'));
        return;
      }
    }
    setSubmitting(true);
    try {
      const device_id = await getOrCreateDeviceId();
      await api.submitEmployeeSurvey(token, { device_id, answers });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView style={styles.errorPage}>
        <Text style={styles.bigEmoji}>🤔</Text>
        <Text style={styles.errorTitle}>{t('scan.invalidQrTitle')}</Text>
        <Text style={styles.errorBody}>{state.error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (submitted) {
    const restaurantName = state.data.restaurant.restaurant_name || state.data.restaurant.display_name;
    return (
      <SafeAreaView style={styles.thanksPage}>
        <Text style={styles.bigEmoji}>🙏</Text>
        <Text style={styles.thanksTitle}>{t('scan.thanksTitle')}</Text>
        <Text style={styles.thanksBody}>{t('scan.thanksSub', { restaurant: restaurantName })}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(consumer)/dashboard')}>
          <Text style={styles.primaryBtnText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { employee, restaurant, survey } = state.data;
  const restaurantName = restaurant.restaurant_name || restaurant.display_name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.gray[50] }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <Text style={styles.bigEmoji}>🍽️</Text>
            <Text style={styles.restaurantName}>{restaurantName}</Text>
            <Text style={styles.subhead}>{t('scan.howWasTime', { name: employee.display_name })}</Text>
          </View>

          {survey.questions.map((q) => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.question}>
                {q.prompt}
                {q.required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {q.type === 'rating_5' && (
                <StarRow value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} />
              )}
              {q.type === 'yes_no' && (
                <YesNoRow
                  value={answers[q.id]}
                  onChange={(v) => updateAnswer(q.id, v)}
                  yesLabel={t('scan.yes')}
                  noLabel={t('scan.no')}
                />
              )}
              {q.type === 'text' && (
                <TextInput
                  value={answers[q.id] || ''}
                  onChangeText={(v) => updateAnswer(q.id, v)}
                  multiline
                  numberOfLines={3}
                  maxLength={2000}
                  placeholder={t('scan.commentPlaceholder')}
                  placeholderTextColor={C.gray[400]}
                  style={styles.input}
                />
              )}
            </View>
          ))}

          {submitError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? t('scan.sendingButton') : t('scan.sendButton')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.anonNote}>{t('scan.anonymousNote')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gray[50] },
  scroll: { padding: 20, paddingBottom: 40 },
  headerBlock: { alignItems: 'center', marginBottom: 20, marginTop: 20 },
  bigEmoji: { fontSize: 44, marginBottom: 10 },
  restaurantName: { fontSize: 22, fontWeight: '700', color: C.gray[900], textAlign: 'center' },
  subhead: { fontSize: 14, color: C.gray[600], marginTop: 6, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.gray[100] },
  question: { fontSize: 15, fontWeight: '600', color: C.gray[800], marginBottom: 14 },
  required: { color: C.consumer.primary },
  starRow: { flexDirection: 'row', gap: 8 },
  starBtn: { flex: 1, height: 52, borderRadius: 12, borderWidth: 2, borderColor: C.gray[200], alignItems: 'center', justifyContent: 'center' },
  starBtnActive: { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  starText: { fontSize: 26, color: C.gray[300] },
  starTextActive: { color: C.consumer.primary },
  yesNoRow: { flexDirection: 'row', gap: 10 },
  yesNoBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: C.gray[200], alignItems: 'center' },
  yesNoBtnActive: { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  yesNoText: { fontSize: 15, fontWeight: '700', color: C.gray[500] },
  yesNoTextActive: { color: C.consumer.primary },
  input: { borderWidth: 1, borderColor: C.gray[200], borderRadius: 12, padding: 12, fontSize: 14, color: C.gray[800], minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: C.consumer.primary, paddingVertical: 16, borderRadius: 14, marginTop: 8, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  anonNote: { fontSize: 12, color: C.gray[400], textAlign: 'center', marginTop: 14, paddingHorizontal: 20 },
  errorBanner: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorBannerText: { color: '#b91c1c', fontSize: 13 },
  errorPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.gray[50] },
  errorTitle: { fontSize: 18, fontWeight: '700', color: C.gray[900], marginBottom: 8, textAlign: 'center' },
  errorBody: { fontSize: 14, color: C.gray[600], textAlign: 'center', marginBottom: 24 },
  thanksPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.consumer.light },
  thanksTitle: { fontSize: 22, fontWeight: '700', color: C.gray[900], marginBottom: 6, textAlign: 'center' },
  thanksBody: { fontSize: 15, color: C.gray[600], textAlign: 'center', marginBottom: 28 },
  primaryBtn: { backgroundColor: C.consumer.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
