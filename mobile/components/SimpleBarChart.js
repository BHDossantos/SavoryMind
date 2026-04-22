import { View, Text, StyleSheet } from 'react-native';

export default function SimpleBarChart({ data, height = 140 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={[styles.wrap, { height }]}>
      {data.map((item) => {
        const pct = (item.value / max) * 0.85;
        return (
          <View key={item.label} style={styles.col}>
            <Text style={styles.count}>{item.value}</Text>
            <View style={styles.barWrap}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(pct * 100, 4)}%`, backgroundColor: item.color },
                ]}
              />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 20 },
  col:     { flex: 1, alignItems: 'center' },
  barWrap: { width: 36, height: '70%', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  bar:     { width: '100%', borderRadius: 4 },
  count:   { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  label:   { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
