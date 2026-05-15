import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { setLanguage, SUPPORTED_LANGUAGES } from '../../services/i18n';
import { C } from '../../constants/colors';

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const { t, i18n } = useTranslation();

  // Same language picker as the consumer / diner profiles — this is the
  // only profile-shaped surface on the restaurant side of the mobile
  // app, so the picker lives here.
  const handlePickLanguage = async (code) => {
    if (code === i18n.language) return;
    await setLanguage(code, {
      syncToServer: (payload) => api.updateAuthProfile(payload),
    });
    setUser((u) => ({ ...u, language: code }));
  };

  const LANGUAGE_LABEL = {
    en: t('profile.languageEnglish'),
    es: t('profile.languageSpanish'),
    it: t('profile.languageItalian'),
    pt: t('profile.languagePortuguese'),
    fr: t('profile.languageFrench'),
  };

  // Features list. Derived per-render so labels re-translate on
  // language switch; icon + screen route stay static.
  const FEATURES = [
    { icon: '📅', title: t('restaurantFeatures.bookings'),      sub: t('restaurantFeatures.bookingsSub'),      screen: 'bookings' },
    { icon: '👥', title: t('restaurantFeatures.crm'),            sub: t('restaurantFeatures.crmSub'),           screen: 'crm' },
    { icon: '🧑‍🍳', title: t('restaurantFeatures.staff'),      sub: t('restaurantFeatures.staffSub'),         screen: 'staff' },
    { icon: '👥', title: t('restaurantFeatures.employees'),      sub: t('restaurantFeatures.employeesSub'),     screen: 'employees' },
    { icon: '🔮', title: t('restaurantFeatures.forecast'),       sub: t('restaurantFeatures.forecastSub'),      screen: 'predictions' },
    { icon: '🚀', title: t('restaurantFeatures.trends'),         sub: t('restaurantFeatures.trendsSub'),        screen: 'trends' },
    { icon: '💌', title: t('restaurantFeatures.marketing'),      sub: t('restaurantFeatures.marketingSub'),     screen: 'marketing' },
    { icon: '🗑️', title: t('restaurantFeatures.foodWaste'),     sub: t('restaurantFeatures.foodWasteSub'),    screen: 'waste' },
    { icon: '📦', title: t('restaurantFeatures.inventory'),      sub: t('restaurantFeatures.inventorySub'),     screen: 'inventory' },
    { icon: '⏱️', title: t('restaurantFeatures.kitchenTimes'),  sub: t('restaurantFeatures.kitchenTimesSub'), screen: 'kitchen' },
    { icon: '🕐', title: t('restaurantFeatures.staffTime'),      sub: t('restaurantFeatures.staffTimeSub'),     screen: 'stafftime' },
    { icon: '🎓', title: t('restaurantFeatures.staffTraining'),  sub: t('restaurantFeatures.staffTrainingSub'), screen: 'training' },
    { icon: '📋', title: t('restaurantFeatures.reports'),        sub: t('restaurantFeatures.reportsSub'),       screen: 'reports' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t('restaurantFeatures.moreTitle')}</Text>
          <Text style={styles.sub}>{user?.display_name || t('common.restaurant')}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <TouchableOpacity
              key={f.title}
              style={styles.featureCard}
              onPress={() => router.push(f.screen)}
              activeOpacity={0.8}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureSub}>{f.sub}</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.langCard}>
          <Text style={styles.langTitle}>{t('profile.language')}</Text>
          <Text style={styles.langHint}>{t('profile.languageDescription')}</Text>
          {SUPPORTED_LANGUAGES.map((code) => {
            const active = i18n.language === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.langRow, active && styles.langRowActive]}
                onPress={() => handlePickLanguage(code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                  {LANGUAGE_LABEL[code]}
                </Text>
                {active && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:           { fontSize: 13, color: C.gray[500], marginTop: 2 },
  logoutBtn:     { marginTop: 4 },
  logoutText:    { fontSize: 13, color: C.gray[400] },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard:   { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.gray[100] },
  featureIcon:   { fontSize: 28, marginBottom: 8 },
  featureTitle:  { fontSize: 14, fontWeight: '700', color: C.gray[900], marginBottom: 3 },
  featureSub:    { fontSize: 11, color: C.gray[500], lineHeight: 16 },
  arrow:         { fontSize: 16, color: C.restaurant.primary, marginTop: 8, fontWeight: '700' },
  langCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: C.gray[100] },
  langTitle:       { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 4 },
  langHint:        { fontSize: 12, color: C.gray[500], marginBottom: 12, lineHeight: 16 },
  langRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.gray[100], marginBottom: 8 },
  langRowActive:   { borderColor: C.restaurant.primary, backgroundColor: C.restaurant.light },
  langLabel:       { fontSize: 14, color: C.gray[700], fontWeight: '600' },
  langLabelActive: { color: C.restaurant.primary },
  langCheck:       { color: C.restaurant.primary, fontWeight: '800', fontSize: 16 },
});
