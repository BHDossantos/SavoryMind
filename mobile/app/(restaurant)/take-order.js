import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { formatEuro } from '../../utils/euro';

// Server-side ordering: pick a table, build a cart from the menu, send it to
// the kitchen. Active tabs show below so the floor can see what's open.
export default function TakeOrderScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const loc = i18n.language;

  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [table, setTable] = useState('');
  const [cart, setCart] = useState([]);        // [{menu_item_id, name, unit_price, quantity}]
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const [m, o] = await Promise.all([
        api.getMenuItems().catch(() => []),
        api.listOrders().catch(() => ({ orders: [] })),
      ]);
      setMenu(Array.isArray(m) ? m : []);
      setOrders((o && o.orders) || []);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const addToCart = (mi) => setCart((c) => {
    const found = c.find((x) => x.menu_item_id === mi.id);
    if (found) return c.map((x) => x.menu_item_id === mi.id ? { ...x, quantity: x.quantity + 1 } : x);
    return [...c, { menu_item_id: mi.id, name: mi.name, unit_price: mi.price, quantity: 1 }];
  });
  const decFromCart = (id) => setCart((c) =>
    c.map((x) => x.menu_item_id === id ? { ...x, quantity: x.quantity - 1 } : x).filter((x) => x.quantity > 0));

  const cartTotal = cart.reduce((s, x) => s + (x.unit_price || 0) * x.quantity, 0);
  const cartCount = cart.reduce((s, x) => s + x.quantity, 0);

  const send = async () => {
    const tbl = parseInt(table, 10);
    if (!tbl || cart.length === 0) return;
    setSubmitting(true);
    try {
      const created = await api.createOrder({
        table_number: tbl,
        items: cart.map((x) => ({ menu_item_id: x.menu_item_id, quantity: x.quantity })),
      });
      await api.submitOrder(created.id);
      setTable(''); setCart([]);
      await load();
      Alert.alert(t('orders.sentTitle'), t('orders.sentBody', { table: tbl }));
    } catch (e) {
      Alert.alert(t('orders.errTitle'), e.message || t('orders.errBody'));
    } finally { setSubmitting(false); }
  };

  const closeOrder = async (id) => {
    try { await api.closeOrder(id); await load(); } catch (e) { setError(e.message); }
  };

  if (loading) return <SafeScreen><ActivityIndicator style={{ marginTop: 40 }} color={C.restaurant.primary} /></SafeScreen>;
  if (error) return <SafeScreen><ErrorMessage message={error} onRetry={load} /></SafeScreen>;

  return (
    <SafeScreen onRefresh={load}>
      <Text style={s.title}>{t('orders.takeTitle')}</Text>

      {/* New order builder */}
      <View style={s.card}>
        <Text style={s.label}>{t('orders.tableNumber')}</Text>
        <TextInput
          value={table}
          onChangeText={setTable}
          keyboardType="number-pad"
          placeholder={t('orders.tablePlaceholder')}
          placeholderTextColor={C.gray[400]}
          style={s.input}
          testID="table-input"
        />

        <Text style={[s.label, { marginTop: 12 }]}>{t('orders.tapToAdd')}</Text>
        <View style={s.menuGrid}>
          {menu.length === 0 && <Text style={s.muted}>{t('orders.noMenu')}</Text>}
          {menu.map((mi) => (
            <TouchableOpacity key={mi.id} style={s.menuChip} onPress={() => addToCart(mi)} testID={`menu-${mi.id}`}>
              <Text style={s.menuChipName}>{mi.name}</Text>
              <Text style={s.menuChipPrice}>{formatEuro(mi.price || 0, loc)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {cart.length > 0 && (
          <View style={s.cart}>
            {cart.map((x) => (
              <View key={x.menu_item_id} style={s.cartRow}>
                <Text style={s.cartName}>{x.quantity}× {x.name}</Text>
                <TouchableOpacity onPress={() => decFromCart(x.menu_item_id)} hitSlop={10}>
                  <Text style={s.cartRemove}>−</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={s.cartTotalRow}>
              <Text style={s.cartTotalLabel}>{t('orders.total')}</Text>
              <Text style={s.cartTotalVal}>{formatEuro(cartTotal, loc)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[s.sendBtn, (!parseInt(table, 10) || cart.length === 0 || submitting) && { opacity: 0.4 }]}
          disabled={!parseInt(table, 10) || cart.length === 0 || submitting}
          onPress={send}
          testID="send-order-btn"
        >
          <Text style={s.sendBtnText}>
            {submitting ? t('orders.sending') : t('orders.sendToKitchen', { count: cartCount })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Open tabs */}
      <Text style={s.section}>{t('orders.openTabs')}</Text>
      {orders.length === 0 && <Text style={s.muted}>{t('orders.noOpen')}</Text>}
      {orders.map((o) => (
        <View key={o.id} style={s.orderRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.orderTable}>{t('orders.table')} {o.table_number}</Text>
            <Text style={s.orderMeta}>
              {o.item_count} {t('orders.dishes')} · {formatEuro(o.total || 0, loc)} · {t(`orders.status.${o.status}`)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => closeOrder(o.id)} style={s.closeBtn}>
            <Text style={s.closeBtnText}>{t('orders.close')}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity onPress={() => router.push('/kitchen-display')} style={s.kdsLink}>
        <Text style={s.kdsLinkText}>👨‍🍳 {t('orders.openKitchen')} →</Text>
      </TouchableOpacity>
    </SafeScreen>
  );
}

const s = StyleSheet.create({
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900], marginBottom: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.gray[100], padding: 16, marginBottom: 20 },
  label:        { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.gray[500], marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.gray[900] },
  menuGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuChip:     { backgroundColor: C.restaurant.light || '#fff7ed', borderWidth: 1, borderColor: C.restaurant.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  menuChipName: { fontSize: 13, fontWeight: '600', color: C.gray[800] },
  menuChipPrice:{ fontSize: 11, color: C.gray[500], marginTop: 2 },
  muted:        { fontSize: 13, color: C.gray[400] },
  cart:         { marginTop: 14, borderTopWidth: 1, borderTopColor: C.gray[100], paddingTop: 10 },
  cartRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  cartName:     { fontSize: 14, color: C.gray[800] },
  cartRemove:   { fontSize: 22, color: C.red, width: 28, textAlign: 'center' },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cartTotalLabel:{ fontSize: 14, fontWeight: '700', color: C.gray[700] },
  cartTotalVal: { fontSize: 14, fontWeight: '800', color: C.gray[900] },
  sendBtn:      { marginTop: 14, backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  section:      { fontSize: 14, fontWeight: '800', color: C.gray[900], marginBottom: 10 },
  orderRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.gray[100], padding: 14, marginBottom: 8 },
  orderTable:   { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  orderMeta:    { fontSize: 12, color: C.gray[500], marginTop: 2 },
  closeBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.gray[200] },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: C.gray[700] },
  kdsLink:      { marginTop: 18, alignItems: 'center', paddingVertical: 12 },
  kdsLinkText:  { fontSize: 15, fontWeight: '700', color: C.restaurant.primary },
});
