import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.msg}>{message}</Text>
      <Text style={styles.hint}>Please check your connection and try again.</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: C.bg },
  icon: { fontSize: 40, marginBottom: 12 },
  msg:  { fontSize: 16, color: C.red, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 13, color: C.gray[400], marginTop: 6, textAlign: 'center' },
  btn:  { marginTop: 16, backgroundColor: C.restaurant.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: C.white, fontWeight: '700', fontSize: 14 },
});
