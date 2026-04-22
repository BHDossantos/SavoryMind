import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import MetricCard from '../../components/MetricCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

const QUICK_ACTIONS = [
  { icon: '📅', label: 'Bookings',    route: '/bookings' },
  { icon: '👥', label: 'CRM',         route: '/crm' },
  { icon: '🔮', label: 'Forecast',    route: '/predictions' },
  { icon: '🗑️', label: 'Food Waste',  route: '/waste' },
  { icon: '⏱️', label: 'Kitchen',     route: '/kitchen' },
  { icon: '🎓', label: 'Training',    route: '/training' },
  { icon: '🧑‍🍳', label: 'Staff',     route: '/staff' },
  { icon: '📋', label: 'Reports',     route: '/reports' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router           = useRouter();
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setStats(await api.getDashboardStats());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message="Loading dashboard..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <SafeScreen onRefresh={load} refreshing={refreshing}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()} 👋</Text>
          <Text style={styles.name}>{user?.display_name || 'Restaurant'}</Text>
        </View>
        <Text onPress={logout} style={styles.logout}>Sign out</Text>
      </View>

      {/* Quick actions grid */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity
            key={q.label}
            style={styles.quickCard}
            onPress={() => router.push(q.route)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickIcon}>{q.icon}</Text>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>Last 30 Days</Text>

      <MetricCard label="Total Revenue"     value={`$${(stats.total_revenue || 0).toLocaleString()}`}   accent={C.restaurant.primary} />
      <MetricCard label="Total Orders"      value={(stats.total_orders || 0).toLocaleString()}            accent={C.restaurant.dark} />
      <MetricCard label="Avg Order Value"   value={`$${(stats.avg_order_value || 0).toFixed(2)}`}         accent="#f59e0b" />
      <MetricCard label="Avg Profit Margin" value={`${(stats.avg_profit_margin || 0).toFixed(1)}%`}       accent={C.green} />
      <MetricCard label="Avg Rating"        value={`⭐ ${(stats.avg_rating || 0).toFixed(1)}`}            accent="#8b5cf6" />
      {stats.top_item && (
        <MetricCard label="Top Seller" value={stats.top_item} sub="by revenue this month" accent="#0d9488" />
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting:   { fontSize: 13, color: C.gray[500] },
  name:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  logout:     { fontSize: 13, color: C.gray[400], marginTop: 4 },
  quickGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickCard:  { width: '22%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.gray[100] },
  quickIcon:  { fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 10, fontWeight: '700', color: C.gray[600], textAlign: 'center' },
  section:    { fontSize: 13, fontWeight: '600', color: C.gray[500], marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
});
