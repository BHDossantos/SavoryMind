import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';

const FEATURES = [
  { icon: '📅', title: 'Bookings',       sub: 'Manage reservations',          screen: 'bookings' },
  { icon: '👥', title: 'CRM',            sub: 'Customer loyalty & history',   screen: 'crm' },
  { icon: '🧑‍🍳', title: 'Staff',        sub: 'Team management',             screen: 'staff' },
  { icon: '🔮', title: 'Forecast',       sub: '4-hour sales forecast',        screen: 'predictions' },
  { icon: '🚀', title: 'Trends',         sub: 'Menu trends & rising stars',   screen: 'trends' },
  { icon: '💌', title: 'Marketing',      sub: 'Guest acquisition & loyalty',  screen: 'marketing' },
  { icon: '🗑️', title: 'Food Waste',     sub: 'Waste log & cost tracking',   screen: 'waste' },
  { icon: '⏱️', title: 'Kitchen Times',  sub: 'Prep & cook time tracking',   screen: 'kitchen' },
  { icon: '🕐', title: 'Staff Time',     sub: 'Shift hours & overtime',       screen: 'stafftime' },
  { icon: '🎓', title: 'Staff Training', sub: 'Performance-based coaching',   screen: 'training' },
  { icon: '📋', title: 'Reports',        sub: 'Analytics & export',           screen: 'reports' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

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
});
