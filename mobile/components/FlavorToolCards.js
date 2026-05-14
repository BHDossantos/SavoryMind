import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';

// Phase 12 — inline tool-result cards in the Flavor chat (mobile).
//
// Mirrors frontend/src/components/FlavorToolCards.js. When Flavor calls
// a data tool, the structured result rides back in tool_calls[].result;
// this turns the renderable ones into horizontally-scrolling cards
// under the message bubble. Tools without a renderer (action / memory
// tools) fall through — the ghost line still covers those.

function WineCard({ w }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardName} numberOfLines={2}>{w.name}</Text>
        {w.confidence != null && (
          <Text style={s.badge}>{Math.round(w.confidence * 100)}%</Text>
        )}
      </View>
      <Text style={s.cardSub}>{w.style}</Text>
      {!!w.flavor_profile && <Text style={s.cardBody} numberOfLines={2}>{w.flavor_profile}</Text>}
      {!!w.rationale && <Text style={s.cardItalic} numberOfLines={3}>{w.rationale}</Text>}
      <View style={s.metaRow}>
        {!!w.price_range && <Text style={s.meta}>💰 {w.price_range}</Text>}
        {!!w.serving_temp && <Text style={s.meta}>🌡 {w.serving_temp}</Text>}
      </View>
    </View>
  );
}

function BeerCard({ b }) {
  return (
    <View style={s.card}>
      <Text style={s.cardName} numberOfLines={2}>{b.name}</Text>
      <Text style={s.cardSub}>{b.style}{b.abv ? ` · ${b.abv}% ABV` : ''}</Text>
      {!!b.flavour && <Text style={s.cardBody} numberOfLines={2}>{b.flavour}</Text>}
      {!!b.serve && <Text style={s.meta}>🍺 {b.serve}</Text>}
    </View>
  );
}

function SpiritCard({ sp }) {
  return (
    <View style={s.card}>
      <Text style={s.cardName} numberOfLines={2}>{sp.name}</Text>
      <Text style={s.cardSub}>{sp.spirit}{sp.region ? ` · ${sp.region}` : ''}</Text>
      {!!sp.flavour && <Text style={s.cardBody} numberOfLines={2}>{sp.flavour}</Text>}
      {!!sp.serve && <Text style={s.meta}>🥃 {sp.serve}</Text>}
    </View>
  );
}

function RecipeCard({ r, onPress }) {
  // Recipes with an id deep-link into guided cooking; others render flat.
  const body = (
    <View style={s.card}>
      <Text style={s.cardEmoji}>{r.image_emoji || '🍽️'}</Text>
      <Text style={s.cardName} numberOfLines={1}>{r.title}</Text>
      {!!r.description && <Text style={s.cardBody} numberOfLines={2}>{r.description}</Text>}
      <View style={s.metaRow}>
        {!!r.cuisine && <Text style={s.chip}>{r.cuisine}</Text>}
        {r.time_minutes != null && <Text style={s.meta}>⏱ {r.time_minutes}m</Text>}
        {!!r.difficulty && <Text style={s.meta}>{r.difficulty}</Text>}
      </View>
    </View>
  );
  return r.id
    ? <TouchableOpacity onPress={() => onPress(r.id)} activeOpacity={0.85}>{body}</TouchableOpacity>
    : body;
}

function ShoppingList({ result }) {
  const { recipe, need_to_buy = [], already_have = [] } = result;
  return (
    <View style={s.listCard}>
      <Text style={s.listTitle}>🛒 Shopping list — {recipe}</Text>
      {need_to_buy.length > 0 ? (
        need_to_buy.map((item, i) => (
          <Text key={i} style={s.listItem}>▢ {item}</Text>
        ))
      ) : (
        <Text style={s.listAllSet}>You've got everything already 🎉</Text>
      )}
      {already_have.length > 0 && (
        <Text style={s.listFooter}>
          Already in your pantry: {already_have.length} item{already_have.length === 1 ? '' : 's'}
        </Text>
      )}
    </View>
  );
}

function Row({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {children}
    </ScrollView>
  );
}

export default function FlavorToolCards({ toolCalls }) {
  const router = useRouter();
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const openRecipe = (id) => router.push({ pathname: '/(consumer)/guided-cooking', params: { id: String(id) } });

  const blocks = [];
  toolCalls.forEach((tc, idx) => {
    const r = tc.result;
    if (!r || typeof r !== 'object' || r.error) return;

    switch (tc.name) {
      case 'search_wines':
        if (r.wines?.length) blocks.push(<Row key={idx}>{r.wines.slice(0, 8).map((w, i) => <WineCard key={i} w={w} />)}</Row>);
        break;
      case 'get_wine_pairing':
        if (r.pairings?.length) blocks.push(<Row key={idx}>{r.pairings.map((w, i) => <WineCard key={i} w={w} />)}</Row>);
        break;
      case 'search_beers':
        if (r.beers?.length) blocks.push(<Row key={idx}>{r.beers.slice(0, 8).map((b, i) => <BeerCard key={i} b={b} />)}</Row>);
        break;
      case 'get_beer_pairing':
        if (r.pairings?.length) blocks.push(<Row key={idx}>{r.pairings.map((b, i) => <BeerCard key={i} b={b} />)}</Row>);
        break;
      case 'search_spirits':
        if (r.spirits?.length) blocks.push(<Row key={idx}>{r.spirits.slice(0, 8).map((sp, i) => <SpiritCard key={i} sp={sp} />)}</Row>);
        break;
      case 'get_spirits_pairing':
        if (r.pairings?.length) blocks.push(<Row key={idx}>{r.pairings.map((sp, i) => <SpiritCard key={i} sp={sp} />)}</Row>);
        break;
      case 'search_recipes':
        if (r.recipes?.length) blocks.push(<Row key={idx}>{r.recipes.slice(0, 8).map((rec, i) => <RecipeCard key={i} r={rec} onPress={openRecipe} />)}</Row>);
        break;
      case 'get_recipe':
        if (r.id) blocks.push(<Row key={idx}><RecipeCard r={r} onPress={openRecipe} /></Row>);
        break;
      case 'suggest_tonight': {
        const recs = [r.top_pick, ...(r.runners_up || [])].filter(Boolean);
        if (recs.length) blocks.push(<Row key={idx}>{recs.map((rec, i) => <RecipeCard key={i} r={rec} onPress={openRecipe} />)}</Row>);
        break;
      }
      case 'build_shopping_list':
        blocks.push(<ShoppingList key={idx} result={r} />);
        break;
      default:
        break;
    }
  });

  if (blocks.length === 0) return null;
  return <View style={{ marginTop: 8 }}>{blocks}</View>;
}

const s = StyleSheet.create({
  row:        { gap: 8, paddingVertical: 2 },
  card:       { width: 180, backgroundColor: '#fff', borderWidth: 1, borderColor: C.consumer.border, borderRadius: 12, padding: 10 },
  cardHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 },
  cardEmoji:  { fontSize: 22, marginBottom: 2 },
  cardName:   { fontSize: 13, fontWeight: '800', color: C.gray[900], flex: 1 },
  cardSub:    { fontSize: 11, color: C.consumer.primary, marginTop: 2 },
  cardBody:   { fontSize: 11, color: C.gray[500], marginTop: 4, lineHeight: 15 },
  cardItalic: { fontSize: 11, color: C.gray[600], marginTop: 4, lineHeight: 15, fontStyle: 'italic' },
  badge:      { fontSize: 10, fontWeight: '800', color: C.consumer.primary, backgroundColor: C.consumer.light, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
  meta:       { fontSize: 10, color: C.gray[400] },
  chip:       { fontSize: 10, color: C.consumer.primary, backgroundColor: C.consumer.light, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },

  listCard:   { backgroundColor: '#fff', borderWidth: 1, borderColor: C.consumer.border, borderRadius: 12, padding: 12 },
  listTitle:  { fontSize: 12, fontWeight: '800', color: C.gray[900], marginBottom: 6 },
  listItem:   { fontSize: 11, color: C.gray[700], marginTop: 2 },
  listAllSet: { fontSize: 11, color: C.green },
  listFooter: { fontSize: 10, color: C.gray[400], marginTop: 6 },
});
