import { useState, useRef, useEffect } from "react";
import { api } from "../../services/api";

const SUGGESTIONS = [
  "My sauce is breaking apart",
  "The meat is too tough",
  "Dish is too salty",
  "Eggs are rubbery",
  "My bread isn't rising",
  "Pasta is too sticky",
  "Vegetables went mushy",
  "How to substitute butter",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      title: "Hi, I'm your culinary assistant!",
      text: "Ask me anything that goes wrong while you're cooking — sauces, seasoning, timing, substitutions, you name it.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const data = await api.askAssistant(q);
      setMessages((m) => [...m, { role: "assistant", title: data.title, text: data.answer }]);
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
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">👨‍🍳 Culinary Assistant</h1>
        <p className="text-gray-400 text-sm mt-1">Real-time help for whatever's going wrong in the kitchen.</p>
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
            placeholder="What's going wrong? (e.g. 'my sauce is too salty')"
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
