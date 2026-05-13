import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { C } from '../../constants/colors';

// "Dine" tab — the gateway into the food-out-of-the-house feature set
// (discover restaurants, manage bookings, log visit history) now that
// the (consumer) shell hosts both Food Lover and Food Explorer features.
// Used to be the (diner) dashboard. We don't redirect into the (diner)
// route group from a tab — tab nav doesn't compose across groups
// cleanly — so this screen acts as a simple hub that pushes to the
// individual (diner)/* screens which still live in that folder.
export default function DineHub() {
  const router = useRouter();
  const { t } = useTranslation();

  const cards = [
    {
      icon: '🔍',
      title: t('dine.discoverTitle'),
      sub: t('dine.discoverSub'),
      onPress: () => router.push('/(diner)/discover'),
    },
    {
      icon: '📅',
      title: t('dine.bookTitle'),
      sub: t('dine.bookSub'),
      onPress: () => router.push('/(diner)/book'),
    },
    {
      icon: '📖',
      title: t('dine.historyTitle'),
      sub: t('dine.historySub'),
      onPress: () => router.push('/(diner)/history'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('dine.title')}</Text>
        <Text style={styles.subtitle}>{t('dine.subtitle')}</Text>

        <View style={{ gap: 12, marginTop: 12 }}>
          {cards.map((c) => (
            <TouchableOpacity
              key={c.title}
              style={styles.card}
              onPress={c.onPress}
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>{c.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardSub}>{c.sub}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  scroll:     { padding: 16, paddingTop: 24, paddingBottom: 40 },
  title:      { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  subtitle:   { fontSize: 13, color: C.gray[500], marginTop: 4, marginBottom: 12 },
  card:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.gray[100] },
  cardIcon:   { fontSize: 30 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  cardSub:    { fontSize: 12, color: C.gray[500], marginTop: 2, lineHeight: 17 },
  arrow:      { fontSize: 22, color: C.consumer.primary, fontWeight: '700' },
});
