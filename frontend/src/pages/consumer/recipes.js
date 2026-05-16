import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

// Backend-stored mood IDs stay English; display labels via i18n.
const MOOD_DEFS = [
  { id: "cozy",        labelKey: "recipesPage.moodCozy" },
  { id: "romantic",    labelKey: "recipesPage.moodRomantic" },
  { id: "light",       labelKey: "recipesPage.moodLight" },
  { id: "adventurous", labelKey: "recipesPage.moodAdventurous" },
  { id: "indulgent",   labelKey: "recipesPage.moodIndulgent" },
  { id: "healthy",     labelKey: "recipesPage.moodHealthy" },
  { id: "brunch",      labelKey: "recipesPage.moodBrunch" },
  { id: "group",       labelKey: "recipesPage.moodGroup" },
  { id: "quick",       labelKey: "recipesPage.moodQuick" },
];

const CUISINES = ["", "Italian", "French", "Thai", "Korean", "Mediterranean", "Middle Eastern", "American", "Modern Café", "North African"];

// Difficulty values from the backend → i18n keys for display.
const DIFFICULTY_KEYS = { Easy: "recipesPage.diffEasy", Medium: "recipesPage.diffMedium", Hard: "recipesPage.diffHard" };

export default function Recipes() {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [keywords, setKeywords] = useState("");
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true); setSelected(null);
    try {
      const data = await api.getRecipes({ mood, cuisine, keywords });
      setRecipes(data.recipes);
      setSearched(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { search(); }, []); // load default on mount

  const handleKeywords = (e) => {
    if (e.key === "Enter") search();
    setKeywords(e.target.value);
  };

  const difficultyLabel = (d) => DIFFICULTY_KEYS[d] ? t(DIFFICULTY_KEYS[d]) : d;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("recipesPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("recipesPage.subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="bg-consumer-50 rounded-2xl p-5 mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-gray-500 self-center mr-1">{t("recipesPage.moodLabel")}</span>
          {MOOD_DEFS.map((m) => (
            <button key={m.id} onClick={() => { setMood(mood === m.id ? "" : m.id); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${mood === m.id ? "bg-consumer-600 text-white" : "bg-white text-gray-600 border border-consumer-200 hover:border-consumer-400"}`}>
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}
            className="border border-consumer-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400">
            <option value="">{t("recipesPage.allCuisines")}</option>
            {CUISINES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={keywords} onChange={(e) => setKeywords(e.target.value)} onKeyDown={handleKeywords}
            placeholder={t("recipesPage.searchPh")}
            className="flex-1 border border-consumer-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 min-w-40"
          />
          <button onClick={search} disabled={loading}
            className="bg-consumer-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-consumer-700 disabled:opacity-60">
            {loading ? t("recipesPage.finding") : t("recipesPage.findRecipes")}
          </button>
        </div>
      </div>

      {/* Recipe grid */}
      {!selected && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {recipes.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)}
              className="text-left bg-white rounded-2xl border border-consumer-100 hover:border-consumer-400 hover:shadow-lg transition-all p-5 group">
              <div className="text-4xl mb-3">{r.image_emoji}</div>
              <h3 className="font-bold text-gray-900 mb-1 group-hover:text-consumer-700">{r.title}</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{r.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full">{r.cuisine}</span>
                <span className="text-xs text-gray-400">⏱️ {r.time_minutes} min</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.difficulty === "Easy" ? "bg-green-100 text-green-700" : r.difficulty === "Medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {difficultyLabel(r.difficulty)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Recipe detail */}
      {selected && (
        <div>
          <button onClick={() => setSelected(null)} className="text-sm text-consumer-600 hover:underline mb-6">{t("recipesPage.back")}</button>
          <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="text-7xl">{selected.image_emoji}</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{selected.title}</h2>
                <p className="text-gray-500 mb-3">{selected.description}</p>
                <div className="flex gap-3 flex-wrap">
                  <span className="text-xs bg-consumer-100 text-consumer-700 px-3 py-1 rounded-full font-medium">{selected.cuisine}</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">⏱️ {selected.time_minutes} min</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{t("recipesPage.serves", { n: selected.servings })}</span>
                  <span className={`text-xs px-3 py-1 rounded-full ${selected.difficulty === "Easy" ? "bg-green-100 text-green-700" : selected.difficulty === "Medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {difficultyLabel(selected.difficulty)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Ingredients */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4">{t("recipesPage.ingredients")}</h3>
                <ul className="space-y-2">
                  {selected.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-consumer-500 mt-0.5">•</span> {ing}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4">{t("recipesPage.method")}</h3>
                <ol className="space-y-3">
                  {selected.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-none w-6 h-6 rounded-full bg-consumer-100 text-consumer-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <p className="text-gray-700 leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Pairings */}
            <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div className="bg-consumer-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-consumer-700 mb-1">{t("recipesPage.wine")}</p>
                <p className="text-sm text-gray-800 font-medium">{selected.wine_pairing}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">{t("recipesPage.beer")}</p>
                <p className="text-sm text-gray-800 font-medium">{selected.beer_pairing}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
