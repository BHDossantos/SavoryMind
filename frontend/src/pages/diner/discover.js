import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { api } from "../../services/api";
import SkeletonLoader from "../../components/SkeletonLoader";

const MOODS = ["", "romantic", "casual", "celebratory", "business", "family"];
const MOOD_LABELS = {
  "": "Any Mood", romantic: "💑 Romantic", casual: "😌 Casual",
  celebratory: "🎉 Celebrate", business: "💼 Business", family: "👨‍👩‍👧 Family",
};
const PRICE_LABELS = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
const STYLE_ICONS = {
  fine_dining: "🕯️", casual_fine: "🍷", bistro: "🥖", casual: "🍔",
  pub: "🍺", cafe: "☕", fast_casual: "🌯",
};

export default function DiscoverPage() {
  const router = useRouter();
  const [mood, setMood]         = useState("");
  const [cuisine, setCuisine]   = useState("");
  const [city, setCity]         = useState("");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [query, setQuery]       = useState("");

  const search = async (m = mood, c = cuisine, ct = city) => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (m) params.mood = m;
      if (c.trim()) params.cuisine = c.trim();
      if (ct.trim()) params.city = ct.trim();
      setResults(await api.discoverRestaurants(params));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { search(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return results;
    const q = query.toLowerCase();
    return results.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.cuisine || []).some((c) => c.toLowerCase().includes(q)) ||
      (r.city || "").toLowerCase().includes(q)
    );
  }, [results, query]);

  const bookRestaurant = (r) => {
    router.push(`/diner/book?restaurant_id=${r.id}&restaurant_name=${encodeURIComponent(r.name)}`);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🔍 Discover Restaurants</h1>
        <p className="text-gray-400 mt-1">Find and book a table at restaurants on SavoryMind</p>
      </div>

      {/* Filters */}
      <div className="bg-diner-50 rounded-2xl p-5 mb-5 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 mr-1">Occasion:</span>
          {MOODS.map((m) => (
            <button key={m || "any"} onClick={() => setMood(m)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                mood === m ? "bg-diner-600 text-white" : "bg-white text-gray-600 border border-diner-200 hover:border-diner-400"
              }`}>
              {MOOD_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <input value={cuisine} onChange={(e) => setCuisine(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(mood, cuisine, city)}
            placeholder="Cuisine (e.g. Italian)"
            className="border border-diner-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 w-40"
          />
          <input value={city} onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(mood, cuisine, city)}
            placeholder="City"
            className="border border-diner-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 w-36"
          />
          <button onClick={() => search(mood, cuisine, city)} disabled={loading}
            className="bg-diner-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-diner-700 disabled:opacity-60">
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* Instant filter */}
      {!loading && results.length > 0 && (
        <div className="mb-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, cuisine, or city…"
            className="w-full border border-diner-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
          />
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-5">{error}</div>}

      {loading ? (
        <SkeletonLoader type="cards" count={4} />
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-diner-50 rounded-2xl">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-gray-700 font-semibold">No restaurants registered yet</p>
          <p className="text-sm text-gray-400 mt-1">Restaurants join SavoryMind and set up their profiles — check back soon!</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 font-medium">No results match "{query}"</p>
          <button onClick={() => setQuery("")} className="mt-2 text-sm text-diner-600 font-semibold hover:underline">Clear</button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-4">{filtered.length} restaurant{filtered.length !== 1 ? "s" : ""} available for booking</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-diner-100 p-5 hover:border-diner-300 hover:shadow-md transition-all flex flex-col">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-diner-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt={r.name} className="w-full h-full object-cover rounded-2xl" />
                      : (STYLE_ICONS[r.dining_style] || "🍽️")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{r.name}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">{PRICE_LABELS[r.price_level] || "$$"}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(r.cuisine || []).slice(0, 2).join(" · ")}
                      {r.city && <span> · 📍 {r.city}</span>}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {r.bio && <p className="text-sm text-gray-600 mb-3 leading-relaxed line-clamp-2">{r.bio}</p>}

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {r.dining_style && (
                    <span className="text-xs bg-diner-50 text-diner-700 px-2 py-0.5 rounded-full capitalize">
                      {r.dining_style.replace("_", " ")}
                    </span>
                  )}
                  {r.serves_wine && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">🍷 Wine</span>}
                  {r.serves_cocktails && <span className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full">🍸 Cocktails</span>}
                  {r.serves_beer && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">🍺 Beer</span>}
                  {r.seating_capacity > 0 && (
                    <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">👥 {r.seating_capacity} seats</span>
                  )}
                </div>

                {/* Available slots preview */}
                {r.available_slots?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {r.available_slots.slice(0, 5).map((t) => (
                      <span key={t} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">{t}</span>
                    ))}
                    {r.available_slots.length > 5 && (
                      <span className="text-xs text-gray-400">+{r.available_slots.length - 5} more</span>
                    )}
                  </div>
                )}

                <button onClick={() => bookRestaurant(r)}
                  className="mt-auto w-full text-sm font-semibold bg-diner-600 text-white py-2.5 rounded-xl hover:bg-diner-700 transition-colors">
                  📅 Book a Table
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
