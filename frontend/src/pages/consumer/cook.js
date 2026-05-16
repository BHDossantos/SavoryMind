import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/LoadingSpinner";

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const MOODS = [
  { id: "cozy",        emoji: "🍲", labelKey: "cookPage.moodCozy" },
  { id: "healthy",     emoji: "🥗", labelKey: "cookPage.moodHealthy" },
  { id: "adventurous", emoji: "🌶️", labelKey: "cookPage.moodAdventurous" },
  { id: "indulgent",   emoji: "🍝", labelKey: "cookPage.moodIndulgent" },
  { id: "quick",       emoji: "⚡", labelKey: "cookPage.moodQuick" },
  { id: "light",       emoji: "🥒", labelKey: "cookPage.moodLight" },
];

const QUICK_LINKS = [
  { href: "/consumer/pantry",  emoji: "🧺", labelKey: "cookPage.quickPantry",  subKey: "cookPage.quickPantrySub" },
  { href: "/consumer/recipes", emoji: "📖", labelKey: "cookPage.quickRecipes", subKey: "cookPage.quickRecipesSub" },
  { href: "/consumer/planner", emoji: "📅", labelKey: "cookPage.quickPlanner", subKey: "cookPage.quickPlannerSub" },
  { href: "/consumer/wine",    emoji: "🍷", labelKey: "cookPage.quickWine",    subKey: "cookPage.quickWineSub" },
  { href: "/consumer/music",   emoji: "🎵", labelKey: "cookPage.quickMusic",   subKey: "cookPage.quickMusicSub" },
];

const DIFF_KEYS = { Easy: "cookPage.diffEasy", Medium: "cookPage.diffMedium", Hard: "cookPage.diffHard" };

export default function CookPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [mood, setMood] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

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
      } catch (e) { setFetchError(e.message || t("cookPage.errLoad")); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadMood = async (m) => {
    setMood(m); setSelected(null); setRecipeLoading(true); setFetchError(null);
    try {
      const data = await api.getRecipes({ mood: m });
      setRecipes(data.recipes || []);
    } catch (e) { setFetchError(e.message || t("cookPage.errLoad")); }
    finally { setRecipeLoading(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {fetchError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{fetchError}</div>
      )}
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("cookPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("cookPage.subtitle")}</p>
      </div>

      {/* Today's suggestion hero */}
      {suggestion && (
        <div className="bg-gradient-to-r from-consumer-600 to-consumer-800 rounded-3xl p-6 mb-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-consumer-200 mb-2">
            {t("cookPage.aiPickFor", { day: suggestion.day })}
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
                  {DIFF_KEYS[suggestion.suggestion?.difficulty]
                    ? t(DIFF_KEYS[suggestion.suggestion.difficulty])
                    : suggestion.suggestion?.difficulty}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/consumer/explore")}
              className="flex-shrink-0 bg-white text-consumer-700 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
              {t("cookPage.findRecipe")}
            </button>
          </div>
        </div>
      )}

      {/* Mood-based discovery */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">{t("cookPage.moodTitle")}</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {MOODS.map((m) => (
            <button key={m.id} onClick={() => loadMood(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${
                mood === m.id
                  ? "bg-consumer-600 text-white border-consumer-600 shadow-md"
                  : "bg-white text-gray-700 border-consumer-200 hover:border-consumer-500 hover:text-consumer-700"
              }`}>
              <span>{m.emoji}</span> {t(m.labelKey)}
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
        <h2 className="text-base font-bold text-gray-900 mb-4">{t("cookPage.moreTools")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className="bg-white border border-consumer-100 rounded-2xl p-4 hover:border-consumer-400 hover:shadow-sm transition-all group">
              <span className="text-2xl block mb-2">{l.emoji}</span>
              <p className="text-sm font-bold text-gray-900 group-hover:text-consumer-700 mb-1">{t(l.labelKey)}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{t(l.subKey)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecipeDetail({ recipe: r, onBack }) {
  const { t } = useTranslation();
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const diffLabel = DIFF_KEYS[r.difficulty] ? t(DIFF_KEYS[r.difficulty]) : r.difficulty;

  return (
    <div className="bg-white rounded-3xl border border-consumer-200 p-6">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-consumer-600 font-semibold hover:text-consumer-800 mb-5">
        {t("cookPage.backToRecipes")}
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
              {diffLabel}
            </span>
            {r.calories_per_serving && (
              <span className="text-sm text-gray-400">🔥 {r.calories_per_serving} {t("cookPage.kcal")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ingredients.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">{t("cookPage.ingredients")}</h3>
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
            <h3 className="text-sm font-bold text-gray-900 mb-3">{t("cookPage.steps")}</h3>
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
        {r.id && (
          <Link href={`/consumer/guided-cooking?id=${r.id}`}
            className="bg-consumer-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
            {t("cookPage.startCooking")}
          </Link>
        )}
        <Link href="/consumer/explore"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          {t("cookPage.exploreMore")}
        </Link>
        <Link href="/consumer/wine"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          {t("cookPage.pairWine")}
        </Link>
        <Link href="/consumer/music"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          {t("cookPage.setMood")}
        </Link>
      </div>
    </div>
  );
}
