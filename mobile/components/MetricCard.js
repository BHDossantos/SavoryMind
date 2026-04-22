import { View, Text, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function MetricCard({ label, value, sub, accent = C.restaurant.primary }) {
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontSize: 12, color: C.gray[500], fontWeight: '500', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '700' },
  sub:   { fontSize: 11, color: C.gray[400], marginTop: 2 },
});
