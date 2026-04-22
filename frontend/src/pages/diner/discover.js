import { useState, useEffect } from "react";
import { api } from "../../services/api";
import DinerLayout from "../../components/DinerLayout";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

const MOODS = ["", "romantic", "adventurous", "relaxed", "celebratory", "group", "healthy", "cozy"];
const MOOD_LABELS = {
  "": "Any Mood", romantic: "💑 Romantic", adventurous: "🌍 Adventurous",
  relaxed: "😌 Relaxed", celebratory: "🎉 Celebrate", group: "👥 Group",
  healthy: "🥗 Healthy", cozy: "🕯️ Cozy",
};
const BUDGETS = [
  { value: "budget", label: "$ Budget", max: 2 },
  { value: "mid",    label: "$$ Mid",    max: 3 },
  { value: "luxury", label: "$$$ Luxury",max: 4 },
];
const PRICE_LABELS = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export default function DiscoverPage() {
  const [mood, setMood]       = useState("");
  const [cuisine, setCuisine] = useState("");
  const [budget, setBudget]   = useState("mid");
  const [results, setResults] = useState([]);
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError]     = useState(null);

  const maxPrice = BUDGETS.find((b) => b.value === budget)?.max ?? 3;

  const search = async (m = mood, b = budget, c = cuisine) => {
    setLoading(true); setError(null); setPlan(null);
    try {
      const params = { max_price_level: BUDGETS.find((x) => x.value === b)?.max ?? 3 };
      if (m) params.mood = m;
      if (c.trim()) params.cuisine = c.trim();
      setResults(await api.discoverRestaurants(params));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const planNight = async () => {
    setPlanLoading(true); setError(null);
    try {
      const params = { budget };
      if (mood) params.mood = mood;
      if (cuisine.trim()) params.cuisine = cuisine.trim();
      setPlan(await api.getExperiencePlan(params));
    } catch (e) { setError(e.message); }
    finally { setPlanLoading(false); }
  };

  useEffect(() => { search(); }, []);

  return (
    <DinerLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🔍 Discover Restaurants</h1>
        <p className="text-gray-400 mt-1">Find your perfect place to eat tonight</p>
      </div>

      {/* Filters */}
      <div className="bg-diner-50 rounded-2xl p-5 mb-6 space-y-4">
        {/* Mood chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 mr-1">Mood:</span>
          {MOODS.map((m) => (
            <button key={m || "any"} onClick={() => setMood(m)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                mood === m ? "bg-diner-600 text-white" : "bg-white text-gray-600 border border-diner-200 hover:border-diner-400"
              }`}>
              {MOOD_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Budget + cuisine + actions */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {BUDGETS.map((b) => (
              <button key={b.value} onClick={() => setBudget(b.value)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  budget === b.value ? "bg-diner-600 text-white" : "bg-white text-gray-600 border border-diner-200 hover:border-diner-400"
                }`}>
                {b.label}
              </button>
            ))}
          </div>
          <input
            value={cuisine} onChange={(e) => setCuisine(e.target.value)}
            placeholder="Cuisine (optional)"
            className="border border-diner-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 w-44"
          />
          <button onClick={() => search(mood, budget, cuisine)} disabled={loading}
            className="bg-diner-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-diner-700 disabled:opacity-60">
            {loading ? "Searching…" : "Search"}
          </button>
          <button onClick={planNight} disabled={planLoading}
            className="bg-white border border-diner-400 text-diner-700 text-sm font-semibold px-5 py-2 rounded-xl hover:bg-diner-50 disabled:opacity-60">
            {planLoading ? "Planning…" : "✨ Plan My Night"}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-5">{error}</div>}

      {/* Experience plan */}
      {plan && (
        <div className="bg-diner-50 border border-diner-200 rounded-2xl p-6 mb-6">
          <p className="text-xl font-bold text-gray-900 mb-4">{plan.experience_title}</p>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">{plan.restaurant.emoji}</span>
            <div>
              <p className="font-bold text-gray-900">{plan.restaurant.name}</p>
              <p className="text-sm text-gray-500">{plan.restaurant.cuisine} · {PRICE_LABELS[plan.restaurant.price_level]}</p>
              <p className="text-sm text-diner-700 italic mt-1">⭐ {plan.restaurant.standout_dish}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="bg-white border border-diner-200 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700">🎵 {plan.music.genre}</span>
            <span className="bg-white border border-diner-200 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700">{plan.drink}</span>
            <span className="bg-white border border-diner-200 rounded-full px-4 py-1.5 text-sm text-gray-500 italic">{plan.music.vibe}</span>
          </div>
          <button onClick={() => setPlan(null)} className="mt-4 text-xs text-gray-400 hover:text-gray-600">✕ Dismiss</button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <LoadingSpinner />
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-gray-500 font-medium">No restaurants match your filters</p>
          <p className="text-sm text-gray-400 mt-1">Try a different mood or budget</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-4">{results.length} places found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {results.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-diner-100 p-5 hover:border-diner-300 hover:shadow-md transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{r.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">{r.name}</h3>
                      <span className="text-xs bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full">⭐ {r.rating}</span>
                    </div>
                    <p className="text-xs text-gray-500">{r.cuisine} · {PRICE_LABELS[r.price_level]} · {r.distance_km}km away</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{r.description}</p>
                <p className="text-xs text-diner-700 italic mb-3">⭐ {r.standout_dish}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {(r.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs bg-diner-50 text-diner-700 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {r.wait_minutes > 0 && <span>⏱ {r.wait_minutes}min wait</span>}
                    <span className={r.open_now ? "text-green-600 font-semibold" : "text-red-500"}>
                      {r.open_now ? "🟢 Open" : "🔴 Closed"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DinerLayout>
  );
}
