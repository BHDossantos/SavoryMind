import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const KITCHEN_STYLES = [
  { id: "comfort",     icon: "🫶", label: "Comfort Cook" },
  { id: "adventurer",  icon: "🌍", label: "The Adventurer" },
  { id: "healthy",     icon: "🥗", label: "Health Advocate" },
  { id: "entertainer", icon: "🥂", label: "The Entertainer" },
  { id: "speed_cook",  icon: "⚡", label: "Speed Cook" },
  { id: "baker",       icon: "🎂", label: "The Baker" },
];

const SKILL_LEVELS = [
  { id: "beginner",     label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced",     label: "Advanced" },
  { id: "chef_energy",  label: "Chef Energy" },
];

const COOK_FREQ = ["Every day", "Weekdays", "Weekends only", "A few times a week", "Rarely"];
const COOK_TIME = ["Under 15 min", "15–30 min", "30–60 min", "1–2 hours", "All day affair"];
const ING_BUDGET = ["budget", "moderate", "premium", "luxury"];
const ING_BUDGET_LABELS = { budget: "💰 Budget", moderate: "🍽️ Moderate", premium: "⭐ Premium", luxury: "💎 Luxury" };

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

const COOKING_GOALS = [
  { id: "healthier",  label: "🥗 Eat healthier" },
  { id: "impress",    label: "🎉 Impress guests" },
  { id: "save_money", label: "💰 Save money" },
  { id: "skills",     label: "📈 Improve skills" },
  { id: "explore",    label: "🌍 Explore cuisines" },
  { id: "meal_prep",  label: "📦 Meal prep" },
  { id: "family",     label: "👨‍👩‍👧 Cook for family" },
];

const FLAVOR_TYPES = ["Sweet", "Savory", "Umami", "Sour / Tangy", "Bitter", "Smoky", "Creamy", "Fresh / Light"];

const MUSIC_GENRES = ["Pop", "Jazz", "Classical", "Hip-Hop", "R&B", "Electronic", "Indie", "Rock", "Latin", "Folk", "Blues", "Country"];

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function ChipToggle({ options, value, onChange, idKey = "id", labelKey = "label", className = "" }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const id = typeof o === "string" ? o : o[idKey];
        const label = typeof o === "string" ? o : o[labelKey];
        const active = selected.includes(id);
        return (
          <button key={id} type="button"
            onClick={() => onChange(active ? selected.filter((x) => x !== id) : [...selected, id])}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-consumer-600 text-white border-consumer-600" : "bg-white text-gray-600 border-gray-200 hover:border-consumer-300"}`}>
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
        const id = typeof o === "string" ? o : o[idKey];
        const label = typeof o === "string" ? o : o[labelKey];
        const active = value === id;
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-consumer-600 text-white border-consumer-600" : "bg-white text-gray-600 border-gray-200 hover:border-consumer-300"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

const TABS = [
  { id: "basic",    label: "Basic Info",    icon: "👤" },
  { id: "kitchen",  label: "Kitchen",       icon: "🍳" },
  { id: "food",     label: "Food Prefs",    icon: "🥗" },
  { id: "goals",    label: "Goals",         icon: "🎯" },
  { id: "music",    label: "Music",         icon: "🎵" },
];

export default function ConsumerProfile() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [basic, setBasic] = useState({
    display_name: user?.display_name || "",
    first_name:   user?.first_name   || "",
    last_name:    user?.last_name    || "",
    city:         user?.city         || "",
    country:      user?.country      || "",
  });

  const [kitchen, setKitchen] = useState({
    kitchen_style:      user?.kitchen_style      || "",
    skill_level:        user?.skill_level        || "",
    cooking_frequency:  user?.cooking_frequency  || "",
    cooking_time_pref:  user?.cooking_time_pref  || "",
    ingredient_budget:  user?.ingredient_budget  || "",
  });

  const [food, setFood] = useState({
    cuisine_preferences: pj(user?.cuisine_preferences, []),
    dietary_preferences: pj(user?.dietary_preferences, []),
    flavor_profile:      pj(user?.flavor_profile, []),
  });

  const [goals, setGoals] = useState({
    cooking_goals: pj(user?.cooking_goals, []),
  });

  const [music, setMusic] = useState({
    music_genres: pj(user?.music_genres, []),
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

  const persona = KITCHEN_STYLES.find((k) => k.id === (kitchen.kitchen_style || user?.kitchen_style));
  const initials = (basic.first_name?.[0] || basic.display_name?.[0] || "U").toUpperCase();

  return (
    <div className="space-y-6">

      {/* Header card */}
      <div className="bg-gradient-to-br from-consumer-600 to-consumer-800 rounded-2xl p-6 text-white flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-extrabold">{basic.first_name ? `${basic.first_name} ${basic.last_name}`.trim() : basic.display_name || "Your Profile"}</h1>
          <p className="text-consumer-200 text-sm">{user?.email}</p>
          {persona && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">
              <span>{persona.icon}</span> {persona.label}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-consumer-50 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setSaved(false); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-white text-consumer-700 shadow-sm" : "text-gray-500 hover:text-consumer-600"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {saved && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">✓ Saved successfully!</div>}

      {/* ── Basic Info ── */}
      {tab === "basic" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-5">
          <h2 className="font-semibold text-gray-800">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input value={basic.first_name} onChange={(e) => setBasic((b) => ({ ...b, first_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input value={basic.last_name} onChange={(e) => setBasic((b) => ({ ...b, last_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
            <input value={basic.display_name} onChange={(e) => setBasic((b) => ({ ...b, display_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input value={basic.city} onChange={(e) => setBasic((b) => ({ ...b, city: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
              <input value={basic.country} onChange={(e) => setBasic((b) => ({ ...b, country: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
          </div>
          <button onClick={() => save(basic)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Kitchen ── */}
      {tab === "kitchen" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">Kitchen Identity</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Cooking Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {KITCHEN_STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setKitchen((k) => ({ ...k, kitchen_style: s.id }))}
                  className={`p-3 rounded-xl border text-left transition-all ${kitchen.kitchen_style === s.id ? "border-consumer-500 bg-consumer-50" : "border-gray-200 hover:border-consumer-300"}`}>
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-xs font-semibold text-gray-800 mt-1">{s.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skill Level</label>
            <RadioGroup options={SKILL_LEVELS} value={kitchen.skill_level} onChange={(v) => setKitchen((k) => ({ ...k, skill_level: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How Often Do You Cook?</label>
            <RadioGroup options={COOK_FREQ} value={kitchen.cooking_frequency} onChange={(v) => setKitchen((k) => ({ ...k, cooking_frequency: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time You Like to Spend</label>
            <RadioGroup options={COOK_TIME} value={kitchen.cooking_time_pref} onChange={(v) => setKitchen((k) => ({ ...k, cooking_time_pref: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredient Budget</label>
            <RadioGroup options={ING_BUDGET.map((b) => ({ id: b, label: ING_BUDGET_LABELS[b] }))} value={kitchen.ingredient_budget} onChange={(v) => setKitchen((k) => ({ ...k, ingredient_budget: v }))} />
          </div>

          <button onClick={() => save(kitchen)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Food Prefs ── */}
      {tab === "food" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">Food Preferences</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Favourite Cuisines</label>
            <ChipToggle options={CUISINES} value={food.cuisine_preferences} onChange={(v) => setFood((f) => ({ ...f, cuisine_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dietary Preferences</label>
            <ChipToggle options={DIETARY} value={food.dietary_preferences} onChange={(v) => setFood((f) => ({ ...f, dietary_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Flavour Profile</label>
            <ChipToggle options={FLAVOR_TYPES} value={food.flavor_profile} onChange={(v) => setFood((f) => ({ ...f, flavor_profile: v }))} />
          </div>

          <button onClick={() => save(food)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Goals ── */}
      {tab === "goals" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">Cooking Goals</h2>
          <p className="text-sm text-gray-500">These power your AI recommendations — pick everything that matters to you.</p>

          <ChipToggle options={COOKING_GOALS} value={goals.cooking_goals} onChange={(v) => setGoals({ cooking_goals: v })} />

          <button onClick={() => save(goals)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Music ── */}
      {tab === "music" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">Music Preferences</h2>
          <p className="text-sm text-gray-500">Used to personalise your cooking soundtrack and music mood suggestions.</p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Favourite Genres</label>
            <ChipToggle options={MUSIC_GENRES} value={music.music_genres} onChange={(v) => setMusic({ music_genres: v })} />
          </div>

          <button onClick={() => save(music)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

    </div>
  );
}
