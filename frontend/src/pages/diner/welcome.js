import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const PRICE_LABELS = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const FEATURES = [
  {
    icon: "🔍",
    title: "Discover",
    desc: "Search by mood, cuisine, or budget. We match restaurants to your taste profile automatically.",
    href: "/diner/discover",
    cta: "Explore restaurants",
    color: "from-diner-500 to-teal-500",
  },
  {
    icon: "📅",
    title: "Book a Table",
    desc: "Reserve instantly — pick your date, time, and party size. Manage all your bookings in one place.",
    href: "/diner/book",
    cta: "Make a reservation",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: "📖",
    title: "My Visits",
    desc: "Log restaurants you've been to, rate them, and build your personal dining history over time.",
    href: "/diner/history",
    cta: "Log a past visit",
    color: "from-amber-400 to-orange-500",
  },
];

export default function DinerWelcomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(null);
  const [bookedMsg, setBookedMsg] = useState("");

  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "Explorer";
  const cuisines = pj(user?.cuisine_preferences, []);
  const occasions = pj(user?.dining_occasions, []);
  const budget = user?.dining_budget || "mid";
  const dietary = pj(user?.dietary_preferences, []);

  const BUDGET_LABELS = { budget: "Budget-friendly", mid: "Mid-range", luxury: "Luxury" };
  const BUDGET_MAX = { budget: 2, mid: 3, luxury: 4 };

  useEffect(() => {
    (async () => {
      try {
        const results = await api.discoverRestaurants({
          max_price_level: BUDGET_MAX[budget] || 3,
          cuisine: cuisines[0] || "",
        });
        setRestaurants(results.slice(0, 4));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const handleBooked = (name) => {
    setReserving(null);
    setBookedMsg(`✓ Booked at ${name}! Head to your dashboard to manage it.`);
    setTimeout(() => setBookedMsg(""), 5000);
  };

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-diner-600 to-teal-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">Welcome to SavoryMind 🎉</p>
          <h1 className="text-3xl font-extrabold mb-2">Hey, {firstName}!</h1>
          <p className="text-white/80 text-base mb-6">
            Your dining profile is ready. Here's what we know about you — and what we can do with it.
          </p>

          {/* Profile pills */}
          <div className="flex flex-wrap gap-2">
            {cuisines.slice(0, 4).map((c) => (
              <span key={c} className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                🍽️ {c}
              </span>
            ))}
            {budget && (
              <span className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                💰 {BUDGET_LABELS[budget] || budget}
              </span>
            )}
            {dietary.slice(0, 2).map((d) => (
              <span key={d} className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                🥗 {d}
              </span>
            ))}
            {occasions.slice(0, 2).map((o) => (
              <span key={o} className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                ✨ {o.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute right-8 top-8 text-8xl opacity-10">🍽️</div>
      </div>

      {bookedMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-700 font-medium mb-6">
          {bookedMsg}
        </div>
      )}

      {/* ── Feature tour ── */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Here's what you can do</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.href} className="bg-white rounded-2xl border border-diner-100 overflow-hidden hover:shadow-md transition-all group">
              <div className={`h-20 bg-gradient-to-br ${f.color} flex items-center justify-center text-4xl`}>
                {f.icon}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-diner-700 transition-colors">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{f.desc}</p>
                <Link href={f.href}
                  className="text-xs text-diner-600 font-semibold hover:text-diner-800 hover:underline">
                  {f.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── First restaurant picks ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">
            Your first picks
            {cuisines.length > 0 && (
              <span className="text-xs font-normal text-diner-600 ml-2">matched to {cuisines[0]}</span>
            )}
          </h2>
          <Link href="/diner/discover" className="text-xs text-diner-600 font-medium hover:underline">See all →</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : restaurants.length === 0 ? (
          <div className="bg-diner-50 rounded-2xl border border-diner-100 py-10 text-center">
            <p className="text-gray-400 text-sm">No restaurants found yet — explore to discover more.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {restaurants.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-diner-100 shadow-sm hover:shadow-md hover:border-diner-300 transition-all overflow-hidden group">
                <div className="h-24 bg-gradient-to-br from-diner-100 to-diner-200 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform">
                  {r.emoji}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-bold text-gray-900 text-xs leading-tight">{r.name}</h3>
                    <span className="text-xs bg-yellow-50 text-yellow-700 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">⭐ {r.rating}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{r.cuisine} · {PRICE_LABELS[r.price_level]}</p>
                  <button onClick={() => setReserving(r)}
                    className="w-full text-xs bg-diner-600 text-white font-semibold py-1.5 rounded-lg hover:bg-diner-700 transition-colors">
                    Reserve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Profile nudge if sparse ── */}
      {(cuisines.length === 0 || !budget) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 mb-6">
          <span className="text-2xl flex-shrink-0">⚡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Complete your taste profile</p>
            <p className="text-xs text-amber-700 mt-0.5">Add your cuisine preferences and budget so we can personalise your picks.</p>
          </div>
          <Link href="/diner/profile"
            className="flex-shrink-0 text-xs bg-amber-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors">
            Edit profile
          </Link>
        </div>
      )}

      {/* ── Go to dashboard ── */}
      <div className="flex items-center justify-between pt-4 border-t border-diner-100">
        <p className="text-sm text-gray-400">You can always revisit this from your profile.</p>
        <button onClick={() => router.push("/diner/dashboard")}
          className="bg-diner-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-diner-700 transition-colors flex items-center gap-2">
          Let's go 🍽️
        </button>
      </div>

      {/* Booking modal */}
      {reserving && (
        <BookingModal restaurant={reserving} onClose={() => setReserving(null)} onBooked={handleBooked} />
      )}
    </div>
  );
}

function BookingModal({ restaurant, onClose, onBooked }) {
  const today = new Date().toISOString().split("T")[0];
  const TIMES = ["12:00","13:00","14:00","18:00","18:30","19:00","19:30","20:00","20:30","21:00"];
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
            <label className="text-xs font-medium text-gray-600 mb-1 block">Party size</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm((f) => ({ ...f, party_size: Math.max(1, f.party_size - 1) }))}
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">−</button>
              <span className="text-lg font-bold text-gray-900 w-6 text-center">{form.party_size}</span>
              <button type="button" onClick={() => setForm((f) => ({ ...f, party_size: Math.min(20, f.party_size + 1) }))}
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">+</button>
            </div>
          </div>
          <textarea value={form.special_requests}
            onChange={(e) => setForm((f) => ({ ...f, special_requests: e.target.value }))}
            rows={2} placeholder="Allergies, occasion, seating preference…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none" />
          <button type="submit" disabled={loading}
            className="w-full bg-diner-600 text-white font-bold py-3 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {loading ? "Booking…" : "Confirm Reservation"}
          </button>
        </form>
      </div>
    </div>
  );
}
