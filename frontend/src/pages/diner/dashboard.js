import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const PRICE_LABELS = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
const STYLE_ICONS = {
  fine_dining: "🕯️", casual_fine: "🍷", bistro: "🥖", casual: "🍔",
  pub: "🍺", cafe: "☕", fast_casual: "🌯",
};

const MOODS = [
  { value: "romantic",    label: "💑 Romantic" },
  { value: "adventurous", label: "🌍 Adventurous" },
  { value: "relaxed",     label: "😌 Relaxed" },
  { value: "celebratory", label: "🎉 Celebrate" },
  { value: "group",       label: "👥 Group" },
  { value: "healthy",     label: "🥗 Healthy" },
  { value: "cozy",        label: "🕯️ Cozy" },
];

const TIMES = ["12:00","12:30","13:00","13:30","14:00","18:00","18:30","19:00","19:30","20:00","20:30","21:00"];
const BUDGETS = [
  { value: "budget", label: "$ Budget",  max: 2 },
  { value: "mid",    label: "$$ Mid",    max: 3 },
  { value: "luxury", label: "$$$ Luxury",max: 4 },
];

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function RestaurantCard({ r, onReserve }) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-2xl border border-diner-100 shadow-sm hover:shadow-md hover:border-diner-300 transition-all overflow-hidden group flex flex-col">
      <div className="h-24 bg-gradient-to-br from-diner-100 to-diner-200 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform overflow-hidden flex-shrink-0">
        {r.avatar_url
          ? <img src={r.avatar_url} alt={r.name} className="w-full h-full object-cover" />
          : (STYLE_ICONS[r.dining_style] || "🍽️")}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{r.name}</h3>
          <span className="text-xs text-gray-400 flex-shrink-0">{PRICE_LABELS[r.price_level] || "$$"}</span>
        </div>
        <p className="text-xs text-gray-500 mb-1 truncate">
          {(r.cuisine || []).slice(0, 2).join(" · ")}
          {r.city && <span className="text-gray-400"> · 📍{r.city}</span>}
        </p>
        {r.bio && <p className="text-xs text-gray-600 leading-relaxed mb-1.5 line-clamp-2">{r.bio}</p>}
        {r.available_slots?.length > 0 && (
          <p className="text-xs text-green-600 mb-2">🕐 {r.available_slots.length} slots available</p>
        )}
        <div className="mt-auto flex gap-1.5 pt-1">
          <button onClick={() => router.push(`/diner/restaurant/${r.id}`)}
            className="flex-1 text-xs font-semibold border border-diner-300 text-diner-700 py-1.5 rounded-lg hover:bg-diner-50 transition-colors">
            View
          </button>
          <button onClick={() => onReserve(r)}
            className="flex-1 text-xs font-semibold bg-diner-600 text-white py-1.5 rounded-lg hover:bg-diner-700 transition-colors">
            📅 Book
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingModal({ restaurant, onClose, onBooked }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    restaurant_name: restaurant?.name || "",
    booking_date: today,
    booking_time: "19:00",
    party_size: 2,
    special_requests: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.booking_date) { setError("Please pick a date."); return; }
    setLoading(true); setError(null);
    try {
      await api.createDinerBooking(form);
      onBooked(form.restaurant_name);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-900">Reserve a Table</h2>
            <p className="text-sm text-diner-600">{restaurant?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
              <input type="date" value={form.booking_date} min={today}
                onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Time</label>
              <select value={form.booking_time} onChange={(e) => setForm((f) => ({ ...f, booking_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400">
                {TIMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Party Size</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm((f) => ({ ...f, party_size: Math.max(1, f.party_size - 1) }))}
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">−</button>
              <span className="text-lg font-bold text-gray-900 w-6 text-center">{form.party_size}</span>
              <button type="button" onClick={() => setForm((f) => ({ ...f, party_size: Math.min(20, f.party_size + 1) }))}
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">+</button>
              <span className="text-sm text-gray-500">guests</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Special Requests</label>
            <textarea value={form.special_requests}
              onChange={(e) => setForm((f) => ({ ...f, special_requests: e.target.value }))}
              rows={2} placeholder="Allergies, occasion, seating preference…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-diner-600 text-white font-bold py-3 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {loading ? "Booking…" : "Confirm Reservation"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DinerDashboard() {
  const { user } = useAuth();

  // Search state
  const [mood,     setMood]     = useState("");
  const [budget,   setBudget]   = useState("mid");
  const [cuisine,  setCuisine]  = useState("");

  // Data
  const [allRests,    setAllRests]    = useState([]);
  const [forYou,      setForYou]      = useState([]);
  const [plan,        setPlan]        = useState(null);
  const [bookings,    setBookings]    = useState([]);
  const [recs,        setRecs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Booking modal
  const [reserving,  setReserving]  = useState(null);
  const [bookedMsg,  setBookedMsg]  = useState(null);

  const userCuisines = pj(user?.cuisine_preferences, []);
  const userOccasions = pj(user?.dining_occasions, []);
  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "Explorer";

  // Load personalised "For You" based on user's cuisine preferences
  const loadForYou = useCallback(async () => {
    try {
      const budgetMax = BUDGETS.find((b) => b.value === (user?.dining_budget || "mid"))?.max || 3;
      // Try to match user's first preferred cuisine; fall back to all
      const prefCuisine = userCuisines[0] || "";
      const results = await api.discoverRestaurants({ max_price_level: budgetMax, cuisine: prefCuisine });
      setForYou(results.length ? results : await api.discoverRestaurants({ max_price_level: budgetMax }));
    } catch {}
  }, [user]);

  const loadAll = useCallback(async () => {
    try {
      const r = await api.discoverRestaurants({ max_price_level: 4 });
      setAllRests(r);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      loadForYou(),
      loadAll(),
      api.getDinerBookings().catch(() => []),
      api.getDinerRecommendations().catch(() => []),
    ]).then(([, , b, r]) => { setBookings(b); setRecs(r); }).finally(() => setLoading(false));
  }, [loadForYou, loadAll]);

  const handleSearch = async () => {
    setSearching(true); setPlan(null); setSearchError(null);
    try {
      const maxPrice = BUDGETS.find((b) => b.value === budget)?.max || 3;
      const params = { max_price_level: maxPrice };
      if (mood) params.mood = mood;
      if (cuisine.trim()) params.cuisine = cuisine.trim();
      setAllRests(await api.discoverRestaurants(params));
    } catch (e) { setSearchError(e.message); }
    finally { setSearching(false); }
  };

  const handlePlanNight = async () => {
    setPlanLoading(true); setPlan(null);
    try {
      const p = await api.getExperiencePlan({ mood: mood || "relaxed", budget, cuisine: cuisine || userCuisines[0] || "" });
      setPlan(p);
    } catch {}
    finally { setPlanLoading(false); }
  };

  const handleReserve = (restaurant) => { setReserving(restaurant); setBookedMsg(null); };
  const handleBooked = (name) => {
    setReserving(null);
    setBookedMsg(`✓ Booking confirmed at ${name}!`);
    api.getDinerBookings().then(setBookings).catch(() => {});
    setTimeout(() => setBookedMsg(null), 5000);
  };

  const upcoming = bookings.filter((b) => b.status === "confirmed").slice(0, 2);

  if (loading) return <LoadingSpinner message="Finding great places for you…" />;

  return (
    <div className="space-y-6">

      {/* Booking modal */}
      {reserving && <BookingModal restaurant={reserving} onClose={() => setReserving(null)} onBooked={handleBooked} />}

      {/* Booked success banner */}
      {bookedMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-700 font-medium">
          {bookedMsg}
        </div>
      )}

      {/* ── Hero search (OpenTable/TheFork style) ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-diner-600 to-teal-700 p-6 text-white">
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName} 👋</p>
          <h1 className="text-2xl font-extrabold mb-4">Find your next great meal</h1>

          {/* Search controls */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 space-y-3">
            {/* Mood chips */}
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setMood(mood === m.value ? "" : m.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${mood === m.value ? "bg-white text-diner-700" : "bg-white/20 text-white hover:bg-white/30"}`}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Budget + cuisine + search */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1 bg-white/10 rounded-xl p-1">
                {BUDGETS.map((b) => (
                  <button key={b.value} onClick={() => setBudget(b.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${budget === b.value ? "bg-white text-diner-700" : "text-white/80 hover:bg-white/20"}`}>
                    {b.label}
                  </button>
                ))}
              </div>
              <input value={cuisine} onChange={(e) => setCuisine(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Cuisine e.g. Italian…"
                className="flex-1 bg-white/20 placeholder-white/60 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:bg-white/30 min-w-32" />
              <button onClick={handleSearch} disabled={searching}
                className="bg-white text-diner-700 font-bold text-sm px-5 py-2 rounded-xl hover:bg-diner-50 disabled:opacity-70 transition-colors">
                {searching ? "Searching…" : "Find a Table"}
              </button>
              <button onClick={handlePlanNight} disabled={planLoading}
                className="bg-diner-800/50 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-diner-800/70 disabled:opacity-70 transition-colors border border-white/20">
                {planLoading ? "Planning…" : "✨ Plan My Night"}
              </button>
            </div>
          </div>
        </div>
        <div className="absolute right-8 top-8 text-7xl opacity-10">🍽️</div>
      </div>

      {/* ── Upcoming booking strip ── */}
      {upcoming.length > 0 && (
        <div className="bg-diner-50 border border-diner-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-semibold text-diner-900 text-sm">Next: {upcoming[0].restaurant_name}</p>
              <p className="text-xs text-diner-600">{upcoming[0].booking_date} at {upcoming[0].booking_time} · {upcoming[0].party_size} guests</p>
            </div>
          </div>
          <Link href="/diner/book" className="text-xs text-diner-600 font-semibold hover:underline whitespace-nowrap">All bookings →</Link>
        </div>
      )}

      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{searchError}</span>
          <button onClick={() => setSearchError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}

      {/* ── AI Experience Plan ── */}
      {plan && (
        <div className="bg-gradient-to-br from-diner-50 to-teal-50 border border-diner-200 rounded-2xl p-6">
          <p className="text-lg font-extrabold text-gray-900 mb-4">{plan.experience_title}</p>
          {plan.restaurant ? (
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-diner-100 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                {plan.restaurant.avatar_url
                  ? <img src={plan.restaurant.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                  : (STYLE_ICONS[plan.restaurant.dining_style] || "🍽️")}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{plan.restaurant.name}</p>
                <p className="text-sm text-gray-500">
                  {(plan.restaurant.cuisine || []).slice(0, 2).join(" · ")}
                  {" · "}{PRICE_LABELS[plan.restaurant.price_level] || "$$"}
                  {plan.restaurant.city && ` · 📍 ${plan.restaurant.city}`}
                </p>
              </div>
              <button onClick={() => handleReserve(plan.restaurant)}
                className="bg-diner-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-diner-700 transition-colors flex-shrink-0">
                Reserve
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic mb-4">No registered restaurants match yet — check back soon!</p>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="bg-white border border-diner-200 rounded-full px-4 py-1.5 text-sm text-gray-700">🎵 {plan.music.genre}</span>
            <span className="bg-white border border-diner-200 rounded-full px-4 py-1.5 text-sm text-gray-700">{plan.drink}</span>
            <span className="bg-white border border-diner-200/60 rounded-full px-4 py-1.5 text-sm text-gray-400 italic">{plan.music.vibe}</span>
          </div>
          <button onClick={() => setPlan(null)} className="mt-3 text-xs text-gray-400 hover:text-gray-500">✕ Dismiss</button>
        </div>
      )}

      {/* ── AI Recommendations ── */}
      {recs.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-900 mb-3">💡 Recommended for You</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recs.map((rec, i) => (
              <Link key={i} href={`/diner/${rec.action}`}
                className="bg-white border border-diner-100 rounded-2xl p-4 hover:border-diner-300 hover:shadow-sm transition-all flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{rec.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{rec.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rec.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── For You (cuisine-matched to profile) ── */}
      {forYou.length > 0 && userCuisines.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">
              ✨ Matched to Your Taste
              <span className="text-xs font-normal text-diner-600 ml-2">({userCuisines.slice(0, 2).join(" · ")})</span>
            </h2>
            <Link href="/diner/discover" className="text-xs text-diner-600 font-medium hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {forYou.slice(0, 4).map((r) => (
              <RestaurantCard key={r.id} r={r} onReserve={handleReserve} />
            ))}
          </div>
        </div>
      )}

      {/* ── All restaurants / search results ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">
            {mood || cuisine ? "Search Results" : "🔥 Top Restaurants"}
          </h2>
          <span className="text-xs text-gray-400">{allRests.length} places</span>
        </div>
        {allRests.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-diner-100">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="text-gray-500 font-medium">No restaurants match your filters</p>
            <p className="text-sm text-gray-400 mt-1">Try a different mood or budget</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allRests.map((r) => (
              <RestaurantCard key={r.id} r={r} onReserve={handleReserve} />
            ))}
          </div>
        )}
      </div>

      {/* ── New user CTA ── */}
      {bookings.length === 0 && (
        <div className="bg-gradient-to-r from-diner-50 to-teal-50 border border-diner-100 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-3xl">🎉</span>
          <div className="flex-1">
            <p className="font-semibold text-diner-900 text-sm">Your dining journey starts here</p>
            <p className="text-xs text-diner-600 mt-0.5">Click Reserve on any restaurant above to make your first booking</p>
          </div>
          <Link href="/diner/history" className="text-xs text-diner-600 font-semibold hover:underline whitespace-nowrap">Log a past visit →</Link>
        </div>
      )}

    </div>
  );
}
