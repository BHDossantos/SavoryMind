import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator,
  ScrollView, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

export default function AssistantScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // ?q= seed param from deep links (Cellar "Ask Flavor about this" cards
  // route here with the question pre-loaded). Auto-sent on mount.
  const params = useLocalSearchParams();

  // Greeting is the first message in the thread. Derived from the i18n
  // bundle so it switches language alongside the rest of the UI; the
  // existing message history (still in whatever language they came in)
  // stays as-is — that's intentional, we don't retranslate user content
  // or past replies after the fact.
  const GREETING = useMemo(() => ({
    role: 'assistant',
    title: t('assistant.greetingTitle'),
    text: t('assistant.greetingText'),
  }), [t]);

  const SUGGESTIONS = useMemo(() => [
    t('assistant.suggestion1'),
    t('assistant.suggestion2'),
    t('assistant.suggestion3'),
    t('assistant.suggestion4'),
    t('assistant.suggestion5'),
    t('assistant.suggestion6'),
  ], [t]);

  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  // Backend-shaped conversation history (Anthropic message format).
  // Kept in a ref so we don't re-render the chat when it updates after
  // a tool-using turn. Sent back on every subsequent request so Flavor
  // can answer follow-ups like "what about a white instead?".
  const historyRef = useRef([]);

  // Auto-send the ?q= seed once on first mount. Guarded so navigating
  // back/forth doesn't re-trigger.
  const seededRef = useRef(false);
  useEffect(() => {
    const seed = typeof params?.q === 'string' ? params.q : Array.isArray(params?.q) ? params.q[0] : null;
    if (seed && !seededRef.current) {
      seededRef.current = true;
      // Defer to the next tick so the GREETING message renders first.
      setTimeout(() => send(seed), 0);
    }
  }, [params?.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToEnd = useCallback(() => {
    // Slight delay so the new message has rendered first.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const send = async (questionOverride) => {
    const q = (questionOverride ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    scrollToEnd();
    setLoading(true);
    try {
      const data = await api.askAssistant(q, historyRef.current);
      // Backend returns the full conversation messages so the next turn
      // has continuity. Store it for the follow-up call — we don't
      // render server-side history (the UI has its own message shape).
      if (Array.isArray(data?.history)) historyRef.current = data.history;
      setMessages((m) => [...m, { role: 'assistant', title: data.title, text: data.answer, toolCalls: data.tool_calls || [] }]);
    } catch (e) {
      setMessages((m) => [...m, {
        role: 'assistant',
        title: t('assistant.errorTitle'),
        text: e.message || t('assistant.errorText'),
      }]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const renderMessage = ({ item: msg }) => {
    if (msg.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{msg.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.botRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>👨‍🍳</Text>
        </View>
        <View style={styles.botBubble}>
          {msg.title && <Text style={styles.botTitle}>{msg.title}</Text>}
          <Text style={styles.botText}>{msg.text}</Text>
          {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
            <Text style={styles.toolGhost} numberOfLines={2}>
              {/* Subtle line showing which tools Flavor consulted. Helps the
                  user understand that the answer was grounded in real data
                  (wine catalog, their pantry, etc.) rather than a guess. */}
              {summariseToolCalls(msg.toolCalls)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // FlatList key extractor: index is fine because we never reorder/remove.
  const keyFor = (_, i) => `m${i}`;

  /** Turn the raw tool_calls array from the backend into a short
   *  "Flavor checked X, Y" line. De-dupes tool names so multiple
   *  calls to the same tool collapse into one mention. */
  function summariseToolCalls(calls) {
    const labels = {
      // Read tools
      search_wines:           'wine catalog',
      search_beers:           'beer catalog',
      search_spirits:         'spirits catalog',
      get_wine_pairing:       'wine pairing',
      get_beer_pairing:       'beer pairing',
      get_spirits_pairing:    'spirits pairing',
      search_recipes:         'recipe catalog',
      get_recipe:             'a recipe',
      get_pantry:             'your pantry',
      get_journal_recent:     'your meal journal',
      get_user_preferences:   'your preferences',
      build_shopping_list:    'your pantry vs. the recipe',
      suggest_tonight:        'your pantry, tastes + journal',
      get_my_bookings:        'your bookings',
      get_visit_history:      'your visit history',
      get_menu:               'the menu',
      get_bookings_today:     'today’s bookings',
      get_sentiment_summary:  'sentiment summary',
      get_inventory_low_stock:'inventory levels',
      get_top_customers:      'top customers',
      // Action tools (writes) — phrased as actions taken so the
      // ghost line reads "✓ Flavor updated your pantry."
      add_to_pantry:            'updated your pantry',
      remove_from_pantry:       'updated your pantry',
      add_pantry_bulk:          'updated your pantry',
      log_meal_memory:          'saved to your journal',
      update_preferences_field: 'updated your preferences',
      create_booking:           'created a booking',
      cancel_booking:           'cancelled a booking',
      log_visit:                'logged a visit',
      add_menu_item:            'added a menu item',
      update_menu_item:         'updated a menu item',
      accept_booking:           'accepted a booking',
      decline_booking:          'declined a booking',
      add_crm_customer:         'added a customer',
      log_inventory_adjustment: 'logged an inventory change',
      respond_to_review:        'replied to a review',
    };
    const seen = new Set();
    const parts = [];
    for (const c of calls) {
      const label = labels[c.name] || c.name;
      if (seen.has(label)) continue;
      seen.add(label);
      parts.push(label);
    }
    if (parts.length === 0) return '';
    if (parts.length === 1) return `✓ Flavor checked ${parts[0]}.`;
    return `✓ Flavor checked ${parts.slice(0, -1).join(', ')} + ${parts[parts.length - 1]}.`;
  }

  // Suggestion chips above the thread when it's still empty (only the
  // initial greeting). Helps users discover what to ask without typing.
  const showSuggestions = messages.length === 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backBtn}>{t('auth.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('assistant.title')}</Text>
        <Text style={styles.sub}>{t('assistant.subtitle')}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)} disabled={loading}>
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyFor}
          renderItem={renderMessage}
          contentContainerStyle={styles.thread}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={loading ? (
            <View style={styles.botRow}>
              <View style={styles.avatar}><Text style={styles.avatarEmoji}>👨‍🍳</Text></View>
              <View style={[styles.botBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={C.consumer.primary} />
              </View>
            </View>
          ) : null}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.inputPlaceholder')}
            placeholderTextColor={C.gray[400]}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>{t('assistant.send')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  header:      { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.gray[100] },
  backBtn:     { fontSize: 14, color: C.gray[600], marginBottom: 8 },
  title:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:         { fontSize: 13, color: C.gray[500], marginTop: 2 },

  kav:         { flex: 1 },

  chipRow:     { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip:        { backgroundColor: C.consumer.light, borderColor: C.consumer.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  chipText:    { fontSize: 12, color: C.consumer.text, fontWeight: '600' },

  thread:      { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },

  userRow:     { flexDirection: 'row', justifyContent: 'flex-end' },
  userBubble:  { maxWidth: '82%', backgroundColor: C.consumer.primary, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  userText:    { color: '#fff', fontSize: 14, lineHeight: 20 },

  botRow:      { flexDirection: 'row', alignItems: 'flex-start' },
  avatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.consumer.light, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 },
  avatarEmoji: { fontSize: 16 },
  botBubble:   { flex: 1, maxWidth: '82%', backgroundColor: '#fff', borderColor: C.consumer.border, borderWidth: 1, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  botTitle:    { fontSize: 11, fontWeight: '800', color: C.consumer.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  botText:     { color: C.gray[700], fontSize: 14, lineHeight: 20 },
  toolGhost:   { color: C.gray[400], fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  typingBubble:{ flexDirection: 'row', alignItems: 'center', height: 36, paddingVertical: 0 },

  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.gray[100], backgroundColor: '#fff' },
  input:       { flex: 1, borderWidth: 1, borderColor: C.consumer.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.gray[900], maxHeight: 100, backgroundColor: C.gray[50] },
  sendBtn:     { backgroundColor: C.consumer.primary, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: C.gray[300] },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
