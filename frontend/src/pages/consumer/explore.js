import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const MOODS = [
  { id: "cozy",        label: "Cozy",         emoji: "🕯️",  desc: "Warm, comforting, slow" },
  { id: "romantic",    label: "Romantic",      emoji: "🥂",  desc: "Intimate & elegant" },
  { id: "adventurous", label: "Adventurous",   emoji: "🌍",  desc: "Bold flavors, new territory" },
  { id: "healthy",     label: "Fresh & Light", emoji: "🥗",  desc: "Clean, nourishing, bright" },
  { id: "indulgent",   label: "Indulgent",     emoji: "🍫",  desc: "Rich, decadent, satisfying" },
  { id: "quick",       label: "Quick & Easy",  emoji: "⚡",  desc: "On the table in 30 min" },
  { id: "celebratory", label: "Celebratory",   emoji: "🎉",  desc: "Special occasion worthy" },
  { id: "brunch",      label: "Brunch Vibes",  emoji: "☀️",  desc: "Leisurely weekend mornings" },
];

const CRAVINGS = [
  { id: "creamy",   label: "Creamy",    emoji: "🧀" },
  { id: "spicy",    label: "Spicy",     emoji: "🌶️" },
  { id: "savory",   label: "Savory",    emoji: "🍖" },
  { id: "sweet",    label: "Sweet",     emoji: "🍯" },
  { id: "smoky",    label: "Smoky",     emoji: "🔥" },
  { id: "fresh",    label: "Fresh",     emoji: "🌿" },
  { id: "tangy",    label: "Tangy",     emoji: "🍋" },
  { id: "umami",    label: "Umami",     emoji: "🍜" },
  { id: "crunchy",  label: "Crunchy",   emoji: "🥨" },
  { id: "rich",     label: "Rich",      emoji: "🥩" },
];

const CUISINES = [
  { id: "Italian",        emoji: "🇮🇹" },
  { id: "Japanese",       emoji: "🇯🇵" },
  { id: "Mexican",        emoji: "🇲🇽" },
  { id: "French",         emoji: "🇫🇷" },
  { id: "Indian",         emoji: "🇮🇳" },
  { id: "Mediterranean",  emoji: "🫒" },
  { id: "Thai",           emoji: "🇹🇭" },
  { id: "American",       emoji: "🇺🇸" },
  { id: "Middle Eastern", emoji: "🥙" },
  { id: "Korean",         emoji: "🇰🇷" },
  { id: "Brazilian",      emoji: "🇧🇷" },
  { id: "Greek",          emoji: "🫧" },
];

const OCCASIONS = [
  { id: "solo",         label: "Solo Reset",     emoji: "🧘" },
  { id: "date",         label: "Date Night",     emoji: "❤️" },
  { id: "family",       label: "Family Dinner",  emoji: "👨‍👩‍👧" },
  { id: "friends",      label: "Friends Over",   emoji: "🥳" },
  { id: "movie",        label: "Movie Night",    emoji: "🍿" },
  { id: "celebration",  label: "Celebration",    emoji: "🎂" },
  { id: "latenight",    label: "Late Night",     emoji: "🌙" },
  { id: "postworkout",  label: "Post-Workout",   emoji: "💪" },
];

const EFFORTS = [
  { id: "Under 15 min", label: "5 min",        emoji: "⚡" },
  { id: "15–30 min",    label: "30 min",        emoji: "🕐" },
  { id: "30–60 min",    label: "1 hour",        emoji: "🍳" },
  { id: "1–2 hours",    label: "Weekend cook",  emoji: "👨‍🍳" },
  { id: "All day affair",label: "Chef project", emoji: "🎓" },
];

const BROWSE_MODES = [
  { id: "mood",     label: "By Mood",     icon: "✨" },
  { id: "craving",  label: "By Craving",  icon: "😋" },
  { id: "cuisine",  label: "By Cuisine",  icon: "🌍" },
  { id: "occasion", label: "By Occasion", icon: "🎯" },
  { id: "effort",   label: "By Effort",   icon: "⏱️" },
];

function RecipeCard({ r, onClick }) {
  return (
    <button onClick={() => onClick(r)} className="text-left bg-white rounded-2xl border border-consumer-100 hover:border-consumer-400 hover:shadow-lg transition-all p-5 group">
      <div className="text-4xl mb-3">{r.image_emoji}</div>
      <h3 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-consumer-700 transition-colors line-clamp-1">{r.title}</h3>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{r.description}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full">{r.cuisine}</span>
        <span className="text-xs text-gray-400">⏱️ {r.time_minutes}m</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${r.difficulty === "Easy" ? "bg-green-50 text-green-700" : r.difficulty === "Medium" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
          {r.difficulty}
        </span>
      </div>
    </button>
  );
}

function RecipeDetail({ r, onBack }) {
  return (
    <div>
      <button onClick={onBack} className="text-sm text-consumer-600 hover:underline mb-6 flex items-center gap-1">
        ← Back to Explore
      </button>
      <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-8">
        <div className="flex items-start gap-6 mb-6">
          <div className="text-7xl">{r.image_emoji}</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{r.title}</h2>
            <p className="text-gray-500 mb-3">{r.description}</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-consumer-100 text-consumer-700 px-3 py-1 rounded-full font-medium">{r.cuisine}</span>
              <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">⏱️ {r.time_minutes} min</span>
              <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">👥 Serves {r.servings}</span>
              <span className={`text-xs px-3 py-1 rounded-full ${r.difficulty === "Easy" ? "bg-green-100 text-green-700" : r.difficulty === "Medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                {r.difficulty}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold text-gray-900 mb-4">🥗 Ingredients</h3>
            <ul className="space-y-2">
              {r.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-consumer-400 mt-0.5">•</span>{ing}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-4">👨‍🍳 Method</h3>
            <ol className="space-y-3">
              {r.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-none w-6 h-6 rounded-full bg-consumer-100 text-consumer-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <p className="text-gray-700 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
          <div className="bg-consumer-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-consumer-700 mb-1">🍷 Wine Pairing</p>
            <p className="text-sm text-gray-800 font-medium">{r.wine_pairing}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">🍺 Beer Pairing</p>
            <p className="text-sm text-gray-800 font-medium">{r.beer_pairing}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          {r.id ? (
            <Link href={`/consumer/guided-cooking?id=${r.id}`}
              className="inline-flex items-center gap-2 bg-consumer-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
              👨‍🍳 Start Cooking
            </Link>
          ) : (
            <Link href="/consumer/cook"
              className="inline-flex items-center gap-2 bg-consumer-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
              👨‍🍳 Cook This Tonight
            </Link>
          )}
          <Link href="/consumer/wine"
            className="inline-flex items-center gap-2 bg-white border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
            🍷 Pair a Wine
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { user } = useAuth();
  const [mode,      setMode]      = useState("mood");
  const [selected,  setSelected]  = useState(null);
  const [recipes,   setRecipes]   = useState([]);
  const [detail,    setDetail]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const userCuisines = pj(user?.cuisine_preferences, []);

  const search = useCallback(async ({ keywords = "", cuisine = "", mood = "", max_time = 0 } = {}) => {
    setLoading(true); setDetail(null); setFetchError(null);
    try {
      const data = await api.getRecipes({ keywords, cuisine, mood, max_time });
      setRecipes(data.recipes || []);
    } catch (e) { setRecipes([]); setFetchError(e.message || "Failed to load recipes."); }
    finally { setLoading(false); }
  }, []);

  // Default load using user's top cuisine preference
  useEffect(() => {
    search({ cuisine: userCuisines[0] || "" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // EFFORT labels map to a max_time (minutes). Used to be passed as the
  // `difficulty` axis which was wrong — recipe.difficulty is Easy/
  // Medium/Hard, not time-banded, so the filter was silently a no-op.
  const EFFORT_MAX_MIN = {
    "Under 15 min":   15,
    "15–30 min":      30,
    "30–60 min":      60,
    "1–2 hours":      120,
    "All day affair": 600,
  };

  const handleSelect = (item) => {
    setSelected(item.id);
    if (mode === "mood")     search({ mood: item.id });
    if (mode === "craving")  search({ keywords: item.id });
    if (mode === "cuisine")  search({ cuisine: item.id });
    if (mode === "occasion") search({ keywords: item.label });
    if (mode === "effort")   search({ max_time: EFFORT_MAX_MIN[item.id] || 0 });
  };

  if (detail) return (
    <div>
      <RecipeDetail r={detail} onBack={() => setDetail(null)} />
    </div>
  );

  const modeOptions = {
    mood:     MOODS,
    craving:  CRAVINGS,
    cuisine:  CUISINES,
    occasion: OCCASIONS,
    effort:   EFFORTS,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Explore</h1>
        <p className="text-gray-400 mt-1">Discover food through how you feel, what you crave, and what tonight calls for.</p>
      </div>

      {/* Browse mode selector */}
      <div className="flex gap-1 bg-consumer-50 rounded-2xl p-1.5 overflow-x-auto">
        {BROWSE_MODES.map((m) => (
          <button key={m.id} onClick={() => { setMode(m.id); setSelected(null); setRecipes([]); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${mode === m.id ? "bg-white text-consumer-700 shadow-sm" : "text-gray-500 hover:text-consumer-600"}`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Option grid */}
      {mode === "mood" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MOODS.map((m) => (
            <button key={m.id} onClick={() => handleSelect(m)}
              className={`p-4 rounded-2xl border text-left transition-all ${selected === m.id ? "border-consumer-500 bg-consumer-50 shadow-md" : "border-gray-200 bg-white hover:border-consumer-300 hover:shadow-sm"}`}>
              <span className="text-3xl">{m.emoji}</span>
              <p className="font-bold text-gray-900 text-sm mt-2">{m.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      )}

      {mode === "craving" && (
        <div className="flex flex-wrap gap-3">
          {CRAVINGS.map((c) => (
            <button key={c.id} onClick={() => handleSelect(c)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all ${selected === c.id ? "border-consumer-500 bg-consumer-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-consumer-300"}`}>
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      )}

      {mode === "cuisine" && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CUISINES.map((c) => (
            <button key={c.id} onClick={() => handleSelect(c)}
              className={`p-4 rounded-2xl border text-center transition-all ${selected === c.id ? "border-consumer-500 bg-consumer-50 shadow-md" : "border-gray-200 bg-white hover:border-consumer-300 hover:shadow-sm"}`}>
              <span className="text-3xl">{c.emoji}</span>
              <p className="font-semibold text-gray-900 text-xs mt-2">{c.id}</p>
            </button>
          ))}
        </div>
      )}

      {mode === "occasion" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {OCCASIONS.map((o) => (
            <button key={o.id} onClick={() => handleSelect(o)}
              className={`p-4 rounded-2xl border text-left transition-all ${selected === o.id ? "border-consumer-500 bg-consumer-50 shadow-md" : "border-gray-200 bg-white hover:border-consumer-300 hover:shadow-sm"}`}>
              <span className="text-3xl">{o.emoji}</span>
              <p className="font-bold text-gray-900 text-sm mt-2">{o.label}</p>
            </button>
          ))}
        </div>
      )}

      {mode === "effort" && (
        <div className="flex flex-wrap gap-3">
          {EFFORTS.map((e) => (
            <button key={e.id} onClick={() => handleSelect(e)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-semibold transition-all ${selected === e.id ? "border-consumer-500 bg-consumer-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-consumer-300"}`}>
              <span className="text-xl">{e.emoji}</span> {e.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {fetchError && !loading && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{fetchError}</div>
      )}
      {loading && <LoadingSpinner message="Finding the perfect matches…" />}

      {!loading && recipes.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">{recipes.length} recipes found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recipes.map((r) => (
              <RecipeCard key={r.id} r={r} onClick={setDetail} />
            ))}
          </div>
        </div>
      )}

      {!loading && recipes.length === 0 && selected && (
        <div className="text-center py-16 bg-white rounded-2xl border border-consumer-100">
          <p className="text-4xl mb-3">🍳</p>
          <p className="text-gray-500">No recipes found — try another option above.</p>
        </div>
      )}

      {!loading && !selected && (
        <div className="bg-gradient-to-br from-consumer-50 to-purple-50 rounded-2xl border border-consumer-100 p-8 text-center">
          <p className="text-4xl mb-3">✨</p>
          <p className="font-semibold text-consumer-800">Choose a mood, craving, or cuisine above</p>
          <p className="text-sm text-consumer-600 mt-1">We'll match recipes that fit exactly what you need tonight.</p>
        </div>
      )}

    </div>
  );
}
