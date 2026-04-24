import { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";
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
const SORT_OPTIONS = [
  { value: "rating",   label: "Top rated" },
  { value: "distance", label: "Nearest" },
  { value: "price_asc",label: "Price ↑" },
  { value: "price_desc",label: "Price ↓" },
];
const MIN_RATINGS = [
  { value: 0,   label: "Any" },
  { value: 3.5, label: "3.5+" },
  { value: 4,   label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

export default function DiscoverPage() {
  const [mood, setMood]         = useState("");
  const [cuisine, setCuisine]   = useState("");
  const [budget, setBudget]     = useState("mid");
  const [results, setResults]   = useState([]);
  const [plan, setPlan]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError]       = useState(null);

  // Client-side filter/sort state
  const [query, setQuery]       = useState("");
  const [minRating, setMinRating] = useState(0);
  const [openOnly, setOpenOnly] = useState(false);
  const [sortBy, setSortBy]     = useState("rating");

  const maxPrice = BUDGETS.find((b) => b.value === budget)?.max ?? 3;

  const search = async (m = mood, b = budget, c = cuisine) => {
    setLoading(true); setError(null); setPlan(null); setQuery("");
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

  const filtered = useMemo(() => {
    let list = results.filter((r) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase()) &&
          !r.cuisine?.toLowerCase().includes(query.toLowerCase()) &&
          !(r.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))) return false;
      if (minRating > 0 && r.rating < minRating) return false;
      if (openOnly && !r.open_now) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "rating")    return b.rating - a.rating;
      if (sortBy === "distance")  return (a.distance_km ?? 99) - (b.distance_km ?? 99);
      if (sortBy === "price_asc") return (a.price_level ?? 0) - (b.price_level ?? 0);
      if (sortBy === "price_desc")return (b.price_level ?? 0) - (a.price_level ?? 0);
      return 0;
    });
    return list;
  }, [results, query, minRating, openOnly, sortBy]);

  const hasActiveFilters = query || minRating > 0 || openOnly;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🔍 Discover Restaurants</h1>
        <p className="text-gray-400 mt-1">Find your perfect place to eat tonight</p>
      </div>

      {/* Backend filters */}
      <div className="bg-diner-50 rounded-2xl p-5 mb-4 space-y-4">
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
            onKeyDown={(e) => e.key === "Enter" && search(mood, budget, cuisine)}
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

      {/* Client-side instant search + sort */}
      {!loading && results.length > 0 && (
        <div className="bg-white border border-diner-100 rounded-2xl px-5 py-4 mb-5 flex flex-wrap gap-3 items-center">
          {/* Name / tag search */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔎</span>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, cuisine, or tag…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-diner-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-diner-400"
            />
            {query && (
              <button onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>

          {/* Min rating */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium">Rating:</span>
            {MIN_RATINGS.map((r) => (
              <button key={r.value} onClick={() => setMinRating(r.value)}
                className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-all ${
                  minRating === r.value ? "bg-yellow-400 text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Open now */}
          <button onClick={() => setOpenOnly((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              openOnly ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            🟢 Open now
          </button>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium">Sort:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-diner-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-diner-400 bg-white">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Clear client filters */}
          {hasActiveFilters && (
            <button onClick={() => { setQuery(""); setMinRating(0); setOpenOnly(false); }}
              className="text-xs text-diner-600 font-semibold hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-gray-500 font-medium">No results match your search</p>
          <button onClick={() => { setQuery(""); setMinRating(0); setOpenOnly(false); }}
            className="mt-3 text-sm text-diner-600 font-semibold hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {filtered.length} of {results.length} places
            {hasActiveFilters && <span className="text-diner-600 font-medium"> · filtered</span>}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((r) => (
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
                      <button key={tag} onClick={() => setQuery(tag)}
                        className="text-xs bg-diner-50 text-diner-700 px-2 py-0.5 rounded-full hover:bg-diner-100 transition-colors cursor-pointer">
                        {tag}
                      </button>
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
    </div>
  );
}
