import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator,
  ScrollView, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

export default function AssistantScreen() {
  const router = useRouter();
  const { t } = useTranslation();

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
      const data = await api.askAssistant(q);
      setMessages((m) => [...m, { role: 'assistant', title: data.title, text: data.answer }]);
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
        </View>
      </View>
    );
  };

  // FlatList key extractor: index is fine because we never reorder/remove.
  const keyFor = (_, i) => `m${i}`;

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
  typingBubble:{ flexDirection: 'row', alignItems: 'center', height: 36, paddingVertical: 0 },

  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.gray[100], backgroundColor: '#fff' },
  input:       { flex: 1, borderWidth: 1, borderColor: C.consumer.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.gray[900], maxHeight: 100, backgroundColor: C.gray[50] },
  sendBtn:     { backgroundColor: C.consumer.primary, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: C.gray[300] },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
