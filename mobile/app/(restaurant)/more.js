import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';

const FEATURES = [
  { icon: '📅', title: 'Bookings',        sub: 'Manage reservations',        screen: '/(restaurant)/bookings' },
  { icon: '👥', title: 'CRM',             sub: 'Customer loyalty & history',  screen: '/(restaurant)/crm' },
  { icon: '🧑‍🍳', title: 'Staff',         sub: 'Team management',            screen: '/(restaurant)/staff' },
  { icon: '🔮', title: 'AI Predictions',  sub: '4-hour sales forecast',      screen: '/(restaurant)/predictions' },
  { icon: '🗑️', title: 'Food Waste',      sub: 'Waste log & cost tracking',  screen: '/(restaurant)/waste' },
  { icon: '⏱️', title: 'Kitchen Times',   sub: 'Prep & cook time tracking',  screen: '/(restaurant)/kitchen' },
  { icon: '🎓', title: 'Staff Training',  sub: 'Data-driven recommendations', screen: '/(restaurant)/training' },
  { icon: '📋', title: 'Reports',         sub: 'Full analytics & CSV export', screen: '/(restaurant)/reports' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleNav = (screen) => {
    Alert.alert('Coming Soon', `${screen.replace('/(restaurant)/', '').replace('-', ' ')} is available on the web at savorymind.net — the mobile screen is in progress.`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>More Features</Text>
          <Text style={styles.sub}>{user?.display_name || 'Restaurant'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <TouchableOpacity
              key={f.title}
              style={styles.featureCard}
              onPress={() => handleNav(f.screen)}
              activeOpacity={0.8}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureSub}>{f.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.webBanner}>
          <Text style={styles.webBannerIcon}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.webBannerTitle}>Full experience on the web</Text>
            <Text style={styles.webBannerSub}>All features are fully available at savorymind.net</Text>
          </View>
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
  webBanner:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.restaurant.light, borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: C.restaurant.border },
  webBannerIcon: { fontSize: 28 },
  webBannerTitle:{ fontSize: 14, fontWeight: '700', color: C.restaurant.text },
  webBannerSub:  { fontSize: 12, color: C.restaurant.muted, marginTop: 2 },
});
