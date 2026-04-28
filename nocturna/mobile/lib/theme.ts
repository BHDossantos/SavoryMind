import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#08070d',
  bg2: '#161224',
  card: '#1f1a30',
  border: 'rgba(255,255,255,0.08)',
  text: '#f4eede',
  dim: 'rgba(244,238,222,0.6)',
  gold: '#d4af56',
  goldDim: 'rgba(212,175,86,0.6)',
  accent: '#ff5f6d',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 32, fontWeight: '600', marginTop: 4 },
  h2: { color: colors.text, fontSize: 22, fontWeight: '500', marginBottom: 8 },
  label: { color: colors.gold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  dim: { color: colors.dim, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, width: '48%', marginBottom: 10 },
  cardTitle: { color: colors.gold, fontSize: 16, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  venueCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginRight: 12, width: 200 },
  btn: { backgroundColor: colors.gold, padding: 14, borderRadius: 999, alignItems: 'center', marginVertical: 6 },
  btnText: { color: colors.bg, fontWeight: '600', fontSize: 15 },
  btnSecondary: { padding: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: colors.goldDim, marginVertical: 6 },
  btnSecondaryText: { color: colors.gold, fontWeight: '500', fontSize: 15 },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, marginVertical: 6 },
  chip: { borderWidth: 1, borderColor: colors.goldDim, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.gold, fontSize: 13 },
  chipTextActive: { color: colors.bg, fontWeight: '600' },
});
