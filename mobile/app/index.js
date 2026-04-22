import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';

const MODES = [
  {
    type: 'consumer',
    icon: '🏠',
    title: 'Home Cook',
    tagline: 'The right wine. The right song. The right recipe.',
    color: C.consumer.primary,
    light: C.consumer.light,
    border: C.consumer.border,
  },
  {
    type: 'diner',
    icon: '🍽️',
    title: 'Diner',
    tagline: 'Remember every great meal. Book the next one.',
    color: C.diner.primary,
    light: C.diner.light,
    border: C.diner.border,
  },
  {
    type: 'restaurant',
    icon: '🏪',
    title: 'Restaurant Owner',
    tagline: 'See your numbers clearly. Serve your guests better.',
    color: C.restaurant.primary,
    light: C.restaurant.light,
    border: C.restaurant.border,
  },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.brand}>SavoryMind</Text>
          <Text style={styles.headline}>Every meal has a story.</Text>
          <Text style={styles.sub}>
            Yours starts here — whether you're in the kitchen,{'\n'}at the table, or behind the pass.
          </Text>
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
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginBold}>Sign in</Text></Text>
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
