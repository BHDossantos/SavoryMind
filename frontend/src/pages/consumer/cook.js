import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/LoadingSpinner";

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const MOODS = [
  { id: "cozy",        emoji: "🍲", label: "Cozy" },
  { id: "healthy",     emoji: "🥗", label: "Healthy" },
  { id: "adventurous", emoji: "🌶️", label: "Adventurous" },
  { id: "indulgent",   emoji: "🍝", label: "Indulgent" },
  { id: "quick",       emoji: "⚡", label: "Quick" },
  { id: "light",       emoji: "🥒", label: "Light" },
];

const QUICK_LINKS = [
  { href: "/consumer/pantry",  emoji: "🧺", label: "My Pantry",     sub: "Cook from what you already have" },
  { href: "/consumer/recipes", emoji: "📖", label: "Recipe Library", sub: "Browse all recipes by cuisine & mood" },
  { href: "/consumer/planner", emoji: "📅", label: "Meal Planner",   sub: "Your 7-day personalised plan" },
  { href: "/consumer/wine",    emoji: "🍷", label: "Wine Pairing",   sub: "Find the perfect bottle for tonight" },
  { href: "/consumer/music",   emoji: "🎵", label: "Mood Music",     sub: "Soundtrack your cooking session" },
];

export default function CookPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mood, setMood] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipeLoading, setRecipeLoading] = useState(false);

  const dietaryPrefs = pj(user?.dietary_preferences, []);
  const cuisinePrefs = pj(user?.cuisine_preferences, []);

  useEffect(() => {
    (async () => {
      try {
        const [sug, recs] = await Promise.all([
          api.getDailySuggestion(),
          api.getRecipes({ cuisine: cuisinePrefs[0] || "" }),
        ]);
        setSuggestion(sug);
        setRecipes(recs.recipes || []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const loadMood = async (m) => {
    setMood(m); setSelected(null); setRecipeLoading(true);
    try {
      const data = await api.getRecipes({ mood: m });
      setRecipes(data.recipes || []);
    } catch {}
    finally { setRecipeLoading(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">👨‍🍳 Cook</h1>
        <p className="text-gray-400 mt-1">What are you cooking tonight?</p>
      </div>

      {/* Today's suggestion hero */}
      {suggestion && (
        <div className="bg-gradient-to-r from-consumer-600 to-consumer-800 rounded-3xl p-6 mb-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-consumer-200 mb-2">
            AI pick for {suggestion.day}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{suggestion.suggestion?.image_emoji || "🍽️"}</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold mb-1">{suggestion.suggestion?.title}</h2>
              <p className="text-consumer-200 text-sm leading-relaxed mb-3">{suggestion.reason}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                  {suggestion.suggestion?.cuisine}
                </span>
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                  ⏱️ {suggestion.suggestion?.time_minutes} min
                </span>
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                  {suggestion.suggestion?.difficulty}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/consumer/explore")}
              className="flex-shrink-0 bg-white text-consumer-700 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
              Find Recipe →
            </button>
          </div>
        </div>
      )}

      {/* Mood-based discovery */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">What's your mood right now?</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {MOODS.map((m) => (
            <button key={m.id} onClick={() => loadMood(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${
                mood === m.id
                  ? "bg-consumer-600 text-white border-consumer-600 shadow-md"
                  : "bg-white text-gray-700 border-consumer-200 hover:border-consumer-500 hover:text-consumer-700"
              }`}>
              <span>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>

        {/* Recipe grid */}
        {recipeLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : selected ? (
          <RecipeDetail recipe={selected} onBack={() => setSelected(null)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recipes.slice(0, 8).map((r) => (
              <button key={r.id} onClick={() => setSelected(r)}
                className="text-left bg-white rounded-2xl border border-consumer-100 hover:border-consumer-400 hover:shadow-lg transition-all p-4 group">
                <div className="text-3xl mb-2">{r.image_emoji}</div>
                <h3 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-consumer-700 line-clamp-1">{r.title}</h3>
                <p className="text-xs text-gray-500 mb-2 leading-relaxed line-clamp-2">{r.description}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full">{r.cuisine}</span>
                  <span className="text-xs text-gray-400">⏱️ {r.time_minutes}m</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">More cooking tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className="bg-white border border-consumer-100 rounded-2xl p-4 hover:border-consumer-400 hover:shadow-sm transition-all group">
              <span className="text-2xl block mb-2">{l.emoji}</span>
              <p className="text-sm font-bold text-gray-900 group-hover:text-consumer-700 mb-1">{l.label}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{l.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecipeDetail({ recipe: r, onBack }) {
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];

  return (
    <div className="bg-white rounded-3xl border border-consumer-200 p-6">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-consumer-600 font-semibold hover:text-consumer-800 mb-5">
        ← Back to recipes
      </button>

      <div className="flex items-start gap-4 mb-6">
        <span className="text-5xl">{r.image_emoji}</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{r.title}</h2>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{r.description}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-sm bg-consumer-100 text-consumer-700 px-3 py-1 rounded-full font-medium">{r.cuisine}</span>
            <span className="text-sm text-gray-500">⏱️ {r.time_minutes} min</span>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              r.difficulty === "Easy" ? "bg-green-100 text-green-700"
              : r.difficulty === "Medium" ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"}`}>
              {r.difficulty}
            </span>
            {r.calories_per_serving && (
              <span className="text-sm text-gray-400">🔥 {r.calories_per_serving} kcal</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ingredients.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Ingredients</h3>
            <ul className="space-y-1.5">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-consumer-400 flex-shrink-0" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}
        {steps.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Steps</h3>
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-consumer-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-consumer-100 flex items-center gap-3 flex-wrap">
        <Link href="/consumer/explore"
          className="bg-consumer-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
          Explore more like this
        </Link>
        <Link href="/consumer/wine"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          🍷 Pair a wine
        </Link>
        <Link href="/consumer/music"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          🎵 Set the mood
        </Link>
      </div>
    </div>
  );
}
