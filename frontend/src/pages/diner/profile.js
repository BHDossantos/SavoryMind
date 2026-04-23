import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

// ── Option sets ───────────────────────────────────────────────────────────────

const OCCASIONS = [
  { id: "romantic",   label: "💑 Date Night" },
  { id: "business",   label: "💼 Business" },
  { id: "family",     label: "👨‍👩‍👧 Family" },
  { id: "social",     label: "🥂 Social" },
  { id: "solo",       label: "🧘 Solo" },
  { id: "celebration",label: "🎉 Celebration" },
  { id: "brunch",     label: "☀️ Brunch" },
  { id: "casual",     label: "😌 Casual" },
];

const ATMOSPHERES = [
  { id: "fine_dining",  label: "🕯️ Fine Dining" },
  { id: "bistro",       label: "🍷 Bistro" },
  { id: "casual",       label: "😊 Casual" },
  { id: "rooftop",      label: "🌅 Rooftop" },
  { id: "outdoor",      label: "🌿 Outdoor" },
  { id: "cosy",         label: "🛋️ Cosy" },
  { id: "lively",       label: "🎶 Lively" },
  { id: "quiet",        label: "🤫 Quiet" },
];

const DINING_FREQ = ["Every week", "2–3 times a week", "Once a week", "A few times a month", "Occasionally"];
const DINING_GROUP_OPTS = ["Solo", "Partner", "Small group (3–5)", "Large group (6+)", "Family with kids"];
const BUDGETS = [
  { id: "budget",   label: "💰 Budget ($)" },
  { id: "mid",      label: "🍽️ Mid ($$)" },
  { id: "upscale",  label: "⭐ Upscale ($$$)" },
  { id: "luxury",   label: "💎 Luxury ($$$$)" },
];

const CUISINES = [
  "Italian","Japanese","Mexican","French","Indian","American","Mediterranean",
  "Thai","Chinese","Greek","Spanish","Middle Eastern","Korean","Vietnamese",
  "Brazilian","Moroccan","Turkish","Ethiopian","Caribbean","Peruvian","Lebanese","Fusion",
];

const DIETARY = [
  { id: "meat_lover",     label: "🥩 Meat Lover" },
  { id: "pescatarian",    label: "🐟 Pescatarian" },
  { id: "vegetarian",     label: "🥦 Vegetarian" },
  { id: "vegan",          label: "🌱 Vegan" },
  { id: "gluten_free",    label: "🌾 Gluten-Free" },
  { id: "dairy_free",     label: "🥛 Dairy-Free" },
  { id: "halal",          label: "☪️ Halal" },
  { id: "kosher",         label: "✡️ Kosher" },
  { id: "keto",           label: "🥑 Keto" },
  { id: "no_restriction", label: "✅ No restrictions" },
];

const DRINKS = [
  { id: "wine",        label: "🍷 Wine" },
  { id: "beer",        label: "🍺 Beer" },
  { id: "cocktails",   label: "🍸 Cocktails" },
  { id: "spirits",     label: "🥃 Spirits" },
  { id: "non_alcoholic",label: "🧃 Non-Alcoholic" },
  { id: "no_alcohol",  label: "🚫 No Alcohol" },
];

const TABS = [
  { id: "basic",   label: "Basic Info",    icon: "👤" },
  { id: "style",   label: "Dining Style",  icon: "🍽️" },
  { id: "food",    label: "Food & Drink",  icon: "🥗" },
  { id: "stats",   label: "My Stats",      icon: "📊" },
];

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function ChipToggle({ options, value, onChange, idKey = "id", labelKey = "label" }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const id    = typeof o === "string" ? o : o[idKey];
        const label = typeof o === "string" ? o : o[labelKey];
        const active = selected.includes(id);
        return (
          <button key={id} type="button"
            onClick={() => onChange(active ? selected.filter((x) => x !== id) : [...selected, id])}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-diner-600 text-white border-diner-600" : "bg-white text-gray-600 border-gray-200 hover:border-diner-300"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function RadioGroup({ options, value, onChange, idKey = "id", labelKey = "label" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const id    = typeof o === "string" ? o : o[idKey];
        const label = typeof o === "string" ? o : o[labelKey];
        const active = value === id;
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-diner-600 text-white border-diner-600" : "bg-white text-gray-600 border-gray-200 hover:border-diner-300"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function DinerProfile() {
  const { user, updateUser } = useAuth();
  const [tab,     setTab]     = useState("basic");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => { api.getDinerSummary().then(setSummary).catch(() => {}); }, []);

  const [basic, setBasic] = useState({
    display_name: user?.display_name || "",
    first_name:   user?.first_name   || "",
    last_name:    user?.last_name    || "",
    city:         user?.city         || "",
    country:      user?.country      || "",
  });

  const [style, setStyle] = useState({
    dining_occasions:  pj(user?.dining_occasions,  []),
    atmosphere_prefs:  pj(user?.atmosphere_prefs,  []),
    dining_frequency:  user?.dining_frequency || "",
    dining_group:      pj(user?.dining_group,      []),
    dining_budget:     user?.dining_budget    || "",
  });

  const [food, setFood] = useState({
    cuisine_preferences: pj(user?.cuisine_preferences, []),
    cuisine_dislikes:    pj(user?.cuisine_dislikes,    []),
    dietary_preferences: pj(user?.dietary_preferences, []),
    drinking_habits:     pj(user?.drinking_habits,     []),
    non_alcoholic_ok:    user?.non_alcoholic_ok ?? true,
  });

  const save = async (payload) => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const serialized = {};
      Object.entries(payload).forEach(([k, v]) => {
        serialized[k] = Array.isArray(v) ? JSON.stringify(v) : v;
      });
      const updated = await api.updateProfile(serialized);
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (basic.first_name?.[0] || basic.display_name?.[0] || "D").toUpperCase();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-br from-diner-600 to-teal-700 rounded-2xl p-6 text-white flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-extrabold">
            {basic.first_name ? `${basic.first_name} ${basic.last_name}`.trim() : basic.display_name || "Your Profile"}
          </h1>
          <p className="text-diner-200 text-sm">{user?.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {style.dining_occasions.slice(0, 3).map((o) => (
              <span key={o} className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 capitalize">{o.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-diner-50 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setSaved(false); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-white text-diner-700 shadow-sm" : "text-gray-500 hover:text-diner-600"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {saved  && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">✓ Saved!</div>}

      {/* ── Basic ── */}
      {tab === "basic" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-diner-100 space-y-5">
          <h2 className="font-semibold text-gray-800">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input value={basic.first_name} onChange={(e) => setBasic((b) => ({ ...b, first_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input value={basic.last_name} onChange={(e) => setBasic((b) => ({ ...b, last_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
            <input value={basic.display_name} onChange={(e) => setBasic((b) => ({ ...b, display_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input value={basic.city} onChange={(e) => setBasic((b) => ({ ...b, city: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
              <input value={basic.country} onChange={(e) => setBasic((b) => ({ ...b, country: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
          </div>
          <button onClick={() => save(basic)} disabled={saving}
            className="bg-diner-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Dining Style ── */}
      {tab === "style" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-diner-100 space-y-6">
          <h2 className="font-semibold text-gray-800">Dining Style</h2>
          <p className="text-sm text-gray-500 -mt-3">These drive your restaurant recommendations on the home page.</p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dining Occasions</label>
            <ChipToggle options={OCCASIONS} value={style.dining_occasions}
              onChange={(v) => setStyle((s) => ({ ...s, dining_occasions: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Atmosphere Preferences</label>
            <ChipToggle options={ATMOSPHERES} value={style.atmosphere_prefs}
              onChange={(v) => setStyle((s) => ({ ...s, atmosphere_prefs: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How Often Do You Dine Out?</label>
            <RadioGroup options={DINING_FREQ} value={style.dining_frequency}
              onChange={(v) => setStyle((s) => ({ ...s, dining_frequency: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Usually Dine With</label>
            <ChipToggle options={DINING_GROUP_OPTS} value={style.dining_group}
              onChange={(v) => setStyle((s) => ({ ...s, dining_group: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget Per Person</label>
            <RadioGroup options={BUDGETS} value={style.dining_budget}
              onChange={(v) => setStyle((s) => ({ ...s, dining_budget: v }))} />
          </div>

          <button onClick={() => save(style)} disabled={saving}
            className="bg-diner-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Food & Drink ── */}
      {tab === "food" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-diner-100 space-y-6">
          <h2 className="font-semibold text-gray-800">Food & Drink Preferences</h2>
          <p className="text-sm text-gray-500 -mt-3">Shared with your Food Lover taste profile — updates both sides.</p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Favourite Cuisines</label>
            <ChipToggle options={CUISINES} value={food.cuisine_preferences}
              onChange={(v) => setFood((f) => ({ ...f, cuisine_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cuisines to Avoid</label>
            <ChipToggle options={CUISINES} value={food.cuisine_dislikes}
              onChange={(v) => setFood((f) => ({ ...f, cuisine_dislikes: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dietary Requirements</label>
            <ChipToggle options={DIETARY} value={food.dietary_preferences}
              onChange={(v) => setFood((f) => ({ ...f, dietary_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Drinks</label>
            <ChipToggle options={DRINKS} value={food.drinking_habits}
              onChange={(v) => setFood((f) => ({ ...f, drinking_habits: v }))} />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setFood((f) => ({ ...f, non_alcoholic_ok: !f.non_alcoholic_ok }))}
              className={`w-12 h-6 rounded-full transition-colors ${food.non_alcoholic_ok ? "bg-diner-500" : "bg-gray-200"}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${food.non_alcoholic_ok ? "translate-x-6" : "translate-x-0"}`} />
            </button>
            <span className="text-sm text-gray-700">Happy with non-alcoholic alternatives</span>
          </div>

          <button onClick={() => save(food)} disabled={saving}
            className="bg-diner-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Stats ── */}
      {tab === "stats" && (
        <div className="space-y-4">
          {summary ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Visits",   value: summary.total_visits,   icon: "🍽️" },
                  { label: "Avg Rating",     value: summary.avg_overall ? Number(summary.avg_overall).toFixed(1) : "—", icon: "⭐" },
                  { label: "Return Rate",    value: summary.return_rate != null ? `${summary.return_rate}%` : "—", icon: "🔁" },
                  { label: "Total Bookings", value: summary.total_bookings,  icon: "📅" },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
                    <p className="text-2xl">{s.icon}</p>
                    <p className="text-2xl font-bold text-diner-700 mt-1">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {summary.top_restaurants?.length > 0 && (
                <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">🏆 Top Spots</h3>
                  <div className="space-y-3">
                    {summary.top_restaurants.map((r, i) => (
                      <div key={r.name} className="flex items-center gap-3">
                        <span className="text-xl">{["🥇","🥈","🥉"][i] || "🍽️"}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{r.name}</p>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                            <div className="bg-diner-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min((r.visits / Math.max(summary.total_visits, 1)) * 100 * 2, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{r.visits}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-diner-100 p-10 text-center">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-gray-500">Log your first visit to see your dining stats here.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
