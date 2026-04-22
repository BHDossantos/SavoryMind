import { SafeAreaView, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { C } from '../constants/colors';

export default function SafeScreen({ children, onRefresh, refreshing = false, style }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, style]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
});
