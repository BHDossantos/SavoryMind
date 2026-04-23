import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Link from "next/link";

const DISH_EMOJIS = ["🍽️", "🍕", "🍝", "🍛", "🍣", "🥗", "🍲", "🌮", "🍔", "🥩", "🐟", "🍜", "🫕", "🥘", "🎂", "🍰"];

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`text-xl transition-all ${onChange ? "hover:scale-110 cursor-pointer" : "cursor-default"} ${s <= (hover || value) ? "opacity-100" : "opacity-25"}`}>
          ⭐
        </button>
      ))}
    </div>
  );
}

const EMPTY_FORM = { dish_name: "", emoji: "🍽️", rating: 5, notes: "", what_id_change: "", cuisine: "" };

export default function JournalPage() {
  const router = useRouter();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Pre-fill form if redirected from guided cooking with query params
  useEffect(() => {
    if (router.query.dish) {
      setForm((f) => ({
        ...f,
        dish_name: router.query.dish || "",
        emoji: router.query.emoji || "🍽️",
        cuisine: router.query.cuisine || "",
      }));
      setShowForm(true);
    }
  }, [router.query]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setMemories(await api.getMemories()); }
    catch {}
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!form.dish_name.trim()) { setError("Enter a dish name."); return; }
    setSaving(true); setError("");
    try {
      const mem = await api.createMemory({
        dish_name: form.dish_name.trim(),
        emoji: form.emoji,
        rating: form.rating,
        notes: form.notes || null,
        what_id_change: form.what_id_change || null,
        cuisine: form.cuisine || null,
      });
      setMemories((prev) => [mem, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📔 My Food Journal</h1>
          <p className="text-gray-400 mt-1">
            {memories.length === 0
              ? "Your cooking memories live here."
              : `${memories.length} meal${memories.length !== 1 ? "s" : ""} remembered`}
          </p>
        </div>
        <button onClick={() => { setShowForm((s) => !s); setError(""); }}
          className={`text-sm font-bold px-5 py-2.5 rounded-xl transition-colors ${
            showForm
              ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
              : "bg-consumer-600 text-white hover:bg-consumer-700"}`}>
          {showForm ? "Cancel" : "+ Log a meal"}
        </button>
      </div>

      {/* Add memory form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-consumer-200 p-6 mb-8 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-5">Log a new memory</h2>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Emoji + dish name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Dish</label>
              <div className="flex gap-2">
                <div className="relative">
                  <button onClick={() => setShowEmojiPicker((s) => !s)}
                    className="w-12 h-10 border border-consumer-200 rounded-xl flex items-center justify-center text-xl hover:bg-consumer-50 transition-colors">
                    {form.emoji}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-12 left-0 z-10 bg-white border border-consumer-200 rounded-2xl p-3 shadow-lg grid grid-cols-4 gap-1.5 w-48">
                      {DISH_EMOJIS.map((e) => (
                        <button key={e} onClick={() => { setForm((f) => ({ ...f, emoji: e })); setShowEmojiPicker(false); }}
                          className="text-xl p-1.5 rounded-lg hover:bg-consumer-50 transition-colors">
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={form.dish_name}
                  onChange={(e) => { setForm((f) => ({ ...f, dish_name: e.target.value })); setError(""); }}
                  placeholder="What did you make?"
                  className="flex-1 border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
                />
              </div>
            </div>

            {/* Cuisine */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Cuisine <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={form.cuisine}
                onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))}
                placeholder="Italian, Thai, Japanese…"
                className="w-full border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
              />
            </div>
          </div>

          {/* Rating */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-2">Your rating</label>
            <StarRating value={form.rating} onChange={(r) => setForm((f) => ({ ...f, rating: r }))} />
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              How did it go? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="The sauce was rich and the pasta perfectly al dente…"
              rows={2}
              className="w-full border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              What would you change? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea value={form.what_id_change}
              onChange={(e) => setForm((f) => ({ ...f, what_id_change: e.target.value }))}
              placeholder="Less salt next time, more chilli…"
              rows={2}
              className="w-full border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
            />
          </div>

          <button onClick={save} disabled={saving}
            className="bg-consumer-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save to journal"}
          </button>
        </div>
      )}

      {/* Memory list */}
      {memories.length === 0 ? (
        <div className="bg-consumer-50 rounded-2xl border border-consumer-100 p-12 text-center">
          <p className="text-4xl mb-3">📔</p>
          <p className="text-gray-500 text-sm mb-4">
            No memories yet. Cook something and log how it went — your food story starts here.
          </p>
          <Link href="/consumer/cook"
            className="inline-flex bg-consumer-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
            Start cooking →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-consumer-100 p-5 hover:shadow-sm transition-all group relative">
              {/* Delete */}
              <button onClick={() => remove(m.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-lg leading-none transition-all">
                ×
              </button>

              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl flex-shrink-0">{m.emoji || "🍽️"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate pr-6">{m.dish_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.cuisine && <span className="mr-2">{m.cuisine}</span>}
                    {formatDate(m.cooked_at)}
                  </p>
                </div>
              </div>

              <StarRating value={m.rating} />

              {m.notes && (
                <p className="text-sm text-gray-600 mt-3 leading-relaxed line-clamp-3 italic">
                  "{m.notes}"
                </p>
              )}

              {m.what_id_change && (
                <div className="mt-3 pt-3 border-t border-consumer-50">
                  <p className="text-xs font-semibold text-consumer-600 mb-0.5">Next time:</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{m.what_id_change}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
