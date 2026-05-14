import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { api } from "../../services/api";
import FlavorToolCards from "../../components/FlavorToolCards";

const SUGGESTIONS = [
  "I'm in the mood for steak — what do you recommend?",
  "Quick weeknight dinner with chicken thighs",
  "My sauce is breaking — how do I save it?",
  "What wine goes with mushroom risotto?",
  "Substitute for buttermilk?",
  "How long to rest a ribeye?",
  "Easy dessert using only pantry staples",
  "Vegan swap for parmesan",
];

// Maps backend tool names to friendly labels used in the ghost line
// under each assistant message. De-dupes so multiple calls to the
// same tool collapse into one mention.
const TOOL_LABELS = {
  // Read
  search_wines:           "wine catalog",
  search_beers:           "beer catalog",
  search_spirits:         "spirits catalog",
  get_wine_pairing:       "wine pairing",
  get_beer_pairing:       "beer pairing",
  get_spirits_pairing:    "spirits pairing",
  search_recipes:         "recipe catalog",
  get_recipe:             "a recipe",
  get_pantry:             "your pantry",
  get_journal_recent:     "your meal journal",
  get_user_preferences:   "your preferences",
  build_shopping_list:    "your pantry vs. the recipe",
  suggest_tonight:        "your pantry, tastes + journal",
  get_my_bookings:        "your bookings",
  get_visit_history:      "your visit history",
  get_menu:               "the menu",
  get_bookings_today:     "today’s bookings",
  get_sentiment_summary:  "sentiment summary",
  get_inventory_low_stock:"inventory levels",
  get_top_customers:      "top customers",
  // Write — phrased as past-tense actions taken
  add_to_pantry:            "updated your pantry",
  remove_from_pantry:       "updated your pantry",
  add_pantry_bulk:          "updated your pantry",
  log_meal_memory:          "saved to your journal",
  update_preferences_field: "updated your preferences",
  create_booking:           "created a booking",
  cancel_booking:           "cancelled a booking",
  log_visit:                "logged a visit",
  add_menu_item:            "added a menu item",
  update_menu_item:         "updated a menu item",
  accept_booking:           "accepted a booking",
  decline_booking:          "declined a booking",
  add_crm_customer:         "added a customer",
  log_inventory_adjustment: "logged an inventory change",
  respond_to_review:        "replied to a review",
  remember_fact:            "noted something for next time",
  recall_facts:             "what she remembers about you",
  forget_fact:              "updated what she remembers",
};

function summariseToolCalls(calls) {
  const seen = new Set();
  const parts = [];
  for (const c of calls) {
    const label = TOOL_LABELS[c.name] || c.name;
    if (seen.has(label)) continue;
    seen.add(label);
    parts.push(label);
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return `✓ Flavor checked ${parts[0]}.`;
  return `✓ Flavor checked ${parts.slice(0, -1).join(", ")} + ${parts[parts.length - 1]}.`;
}

const GREETING = {
  role: "assistant",
  title: "Hey, I'm Flavor 👋",
  text: "Ask me anything food-related — recipe ideas, technique tips, fixes for what's going wrong, ingredient swaps, wine pairings. Whatever's on the stove.",
};

/**
 * Rebuild the UI message list from a persisted Anthropic-shape thread
 * (Phase 14 resume). User string messages + assistant text blocks
 * become UI bubbles; tool_result plumbing rows are skipped. Tool
 * cards aren't reconstructed on resume — the text answer carries the
 * substance, and any NEW tool calls this session still render fully.
 */
function rebuildUiMessages(serverMessages) {
  const ui = [];
  for (const m of serverMessages || []) {
    if (m.role === "user" && typeof m.content === "string") {
      ui.push({ role: "user", text: m.content });
    } else if (m.role === "assistant") {
      const blocks = Array.isArray(m.content) ? m.content : [];
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      if (!text) continue;
      let title = "Flavor", body = text;
      if (text.toUpperCase().startsWith("TITLE:")) {
        const nl = text.indexOf("\n");
        if (nl > 0) { title = text.slice(6, nl).trim(); body = text.slice(nl + 1).trim(); }
      }
      ui.push({ role: "assistant", title, text: body });
    }
  }
  return ui;
}

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  // Phase 14 — server-side conversation persistence. The id of the
  // active thread; null = a fresh conversation. Sent on every request
  // so the server loads the right history; updated from the response.
  const conversationIdRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Phase 14 — resume the most recent conversation on mount. If the
  // user has prior threads, load the latest one back into the chat.
  // Skipped when a ?q= seed is present (a deep-link starts fresh).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || resumedRef.current) return;
    resumedRef.current = true;
    if (router.query.q) return; // deep-link → fresh conversation
    (async () => {
      try {
        const { conversations } = await api.listConversations();
        if (!conversations || conversations.length === 0) return;
        const latest = conversations[0];
        const thread = await api.getConversation(latest.id);
        const ui = rebuildUiMessages(thread.messages);
        if (ui.length > 0) {
          setMessages([GREETING, ...ui]);
          conversationIdRef.current = latest.id;
        }
      } catch {
        // No big deal — start fresh if resume fails.
      }
    })();
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send the ?q= seed once on first mount — deep-link target for
  // Cellar "Ask Flavor about this" cards. Guarded so back-nav doesn't
  // re-trigger.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.q;
    const seed = typeof q === "string" ? q : Array.isArray(q) ? q[0] : null;
    if (seed && !seededRef.current) {
      seededRef.current = true;
      // Clear the param from the URL so refresh doesn't replay.
      router.replace("/consumer/assistant", undefined, { shallow: true });
      setTimeout(() => send(seed), 0);
    }
  }, [router.isReady, router.query.q]); // eslint-disable-line react-hooks/exhaustive-deps

  // "New chat" — clears the thread back to just the greeting and
  // detaches from the persisted conversation so the next message
  // starts a fresh one.
  const newChat = () => {
    setMessages([GREETING]);
    conversationIdRef.current = null;
    setInput("");
  };

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const data = await api.askAssistant(q, conversationIdRef.current);
      if (data?.conversation_id) conversationIdRef.current = data.conversation_id;
      setMessages((m) => [...m, {
        role: "assistant",
        title: data.title,
        text: data.answer,
        toolCalls: data.tool_calls || [],
      }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", title: "Oops", text: e.message || "Something went wrong — try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 160px)" }}>
      {/* Header */}
      <div className="mb-4 flex-shrink-0 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👨‍🍳 Flavor</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time help for whatever's going wrong in the kitchen.</p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={newChat}
            className="flex-shrink-0 text-xs font-semibold text-consumer-700 border border-consumer-200 rounded-full px-3 py-1.5 hover:bg-consumer-50 transition-colors">
            + New chat
          </button>
        )}
      </div>

      {/* Suggestion chips */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-xs bg-consumer-50 border border-consumer-200 text-consumer-700 font-medium px-3 py-1.5 rounded-full hover:bg-consumer-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-consumer-100 flex items-center justify-center text-lg flex-shrink-0 mr-2 mt-1">
                👨‍🍳
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-consumer-600 text-white rounded-br-sm"
                : "bg-white border border-consumer-100 shadow-sm rounded-bl-sm"
            }`}>
              {msg.role === "assistant" && msg.title && (
                <p className="text-xs font-bold text-consumer-700 mb-1">{msg.title}</p>
              )}
              <p className={`text-sm leading-relaxed ${msg.role === "user" ? "text-white" : "text-gray-700"}`}>
                {msg.text}
              </p>
              {msg.role === "assistant" && (
                <FlavorToolCards toolCalls={msg.toolCalls} />
              )}
              {msg.role === "assistant" && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                <p className="text-[11px] italic text-gray-400 mt-2">
                  {summariseToolCalls(msg.toolCalls)}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-consumer-100 flex items-center justify-center text-lg flex-shrink-0 mr-2">
              👨‍🍳
            </div>
            <div className="bg-white border border-consumer-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-consumer-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-consumer-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-consumer-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-4 border-t border-consumer-100 mt-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything — recipes, techniques, pairings, fixes..."
            rows={2}
            className="flex-1 border border-consumer-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="bg-consumer-600 text-white font-bold px-5 rounded-2xl hover:bg-consumer-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
