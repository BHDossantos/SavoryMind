import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { C } from '../constants/colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // Two modes only: anyone who eats food (consumer — cook + dine
  // unified) and restaurant operators. The Food Lover / Food Explorer
  // split that used to exist forced users to pick one half of the app;
  // the consumer shell now hosts both. Restaurant Owner stays separate
  // because the mental model + permissions are different.
  const MODES = [
    {
      type: 'consumer',
      icon: '🍴',
      title: t('welcome.foodPerson'),
      tagline: t('welcome.foodPersonTagline'),
      color: C.consumer.primary,
      light: C.consumer.light,
      border: C.consumer.border,
    },
    {
      type: 'restaurant',
      icon: '🏪',
      title: t('welcome.restaurantOwner'),
      tagline: t('welcome.restaurantOwnerTagline'),
      color: C.restaurant.primary,
      light: C.restaurant.light,
      border: C.restaurant.border,
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.brand}>SavoryMind</Text>
          <Text style={styles.headline}>{t('welcome.tagline')}</Text>
          <Text style={styles.sub}>{t('welcome.subtitle')}</Text>
        </View>

        <View style={styles.cards}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.type}
              style={[styles.card, { backgroundColor: m.light, borderColor: m.border }]}
              onPress={() => router.push(`/signup?type=${m.type}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>{m.icon}</Text>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: m.color }]}>{m.title}</Text>
                <Text style={styles.cardTagline}>{m.tagline}</Text>
              </View>
              <Text style={[styles.arrow, { color: m.color }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
          <Text style={styles.loginText}>
            {t('welcome.alreadyHaveAccount')}{' '}
            <Text style={styles.loginBold}>{t('welcome.signIn')}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  container:  { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  header:     { alignItems: 'center', marginBottom: 32 },
  logo:       { fontSize: 48, marginBottom: 8 },
  brand:      { fontSize: 28, fontWeight: '800', color: C.gray[900], marginBottom: 16 },
  headline:   { fontSize: 22, fontWeight: '700', color: C.gray[900], textAlign: 'center' },
  sub:        { fontSize: 14, color: C.gray[500], textAlign: 'center', marginTop: 8, lineHeight: 21 },
  cards:      { gap: 12 },
  card:       { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 1.5, gap: 14 },
  cardIcon:   { fontSize: 30 },
  cardBody:   { flex: 1 },
  cardTitle:  { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardTagline:{ fontSize: 12, color: C.gray[500], lineHeight: 17 },
  arrow:      { fontSize: 28, fontWeight: '300' },
  loginLink:  { marginTop: 28, alignItems: 'center' },
  loginText:  { fontSize: 14, color: C.gray[500] },
  loginBold:  { fontWeight: '700', color: C.gray[800] },
});
