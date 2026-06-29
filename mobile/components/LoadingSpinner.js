import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function LoadingSpinner({ message = 'Loading...', color = C.restaurant.primary }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={color} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  text: { marginTop: 12, color: C.gray[500], fontSize: 14 },
});
