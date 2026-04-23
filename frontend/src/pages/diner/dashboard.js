import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const DINING_PERSONAS = {
  adventurous: { icon: "🌍", label: "The Explorer",      color: "from-emerald-400 to-teal-600" },
  romantic:    { icon: "🕯️",  label: "Romance Seeker",   color: "from-rose-400 to-pink-600" },
  foodie:      { icon: "🍜",  label: "Foodie at Heart",  color: "from-orange-400 to-amber-600" },
  social:      { icon: "🥂",  label: "Social Butterfly", color: "from-purple-400 to-violet-600" },
  healthy:     { icon: "🥗",  label: "Wellness Diner",   color: "from-green-400 to-emerald-600" },
  comfort:     { icon: "🍲",  label: "Comfort Seeker",   color: "from-amber-400 to-orange-600" },
  business:    { icon: "💼",  label: "Business Diner",   color: "from-slate-400 to-gray-600" },
  family:      { icon: "👨‍👩‍👧", label: "Family First",    color: "from-blue-400 to-cyan-600" },
};

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default function DinerDashboard() {
  const { user } = useAuth();
  const [summary,   setSummary]   = useState(null);
  const [bookings,  setBookings]  = useState([]);
  const [visits,    setVisits]    = useState([]);
  const [recs,      setRecs]      = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDinerSummary().catch(() => null),
      api.getDinerBookings().catch(() => []),
      api.getDinerVisits().catch(() => []),
      api.getDinerRecommendations().catch(() => []),
    ])
      .then(([s, b, v, r]) => { setSummary(s); setBookings(b); setVisits(v); setRecs(r); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />;

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "Foodie";

  // derive persona from onboarding answers
  const occasions  = pj(user?.dining_occasions, []);
  const rawPersona = occasions.includes("romantic") ? "romantic"
                   : occasions.includes("business") ? "business"
                   : occasions.includes("family")   ? "family"
                   : occasions.includes("social")   ? "social"
                   : pj(user?.cuisine_preferences, []).length > 4 ? "adventurous"
                   : pj(user?.dietary_preferences, []).includes("vegetarian") || pj(user?.dietary_preferences, []).includes("vegan") ? "healthy"
                   : "foodie";
  const persona    = DINING_PERSONAS[rawPersona] || DINING_PERSONAS.foodie;
  const cuisines   = pj(user?.cuisine_preferences, []).slice(0, 5);
  const budget     = user?.dining_budget;

  const upcoming  = bookings.filter((b) => b.status === "confirmed").slice(0, 3);
  const recent    = visits.slice(0, 4);

  const QUICK_ACTIONS = [
    { href: "/diner/book",     icon: "📅", label: "Book a Table",   sub: "Reserve your next meal" },
    { href: "/diner/discover", icon: "🔍", label: "Discover",       sub: "Find new restaurants" },
    { href: "/diner/history",  icon: "📖", label: "Visit History",  sub: "Review past experiences" },
    { href: "/diner/profile",  icon: "⚙️", label: "Preferences",   sub: "Update your taste profile" },
  ];

  const isNewUser = !summary || (summary.total_visits === 0 && summary.total_bookings === 0);

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${persona.color} p-6 text-white`}>
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">{greeting} 👋</p>
          <h1 className="text-2xl font-extrabold">{firstName}</h1>
          <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-1.5">
            <span className="text-lg">{persona.icon}</span>
            <span className="text-sm font-semibold">{persona.label}</span>
          </div>
          {cuisines.length > 0 && (
            <p className="mt-3 text-white/70 text-xs">Loves: {cuisines.join(" · ")}</p>
          )}
          {budget && (
            <p className="mt-1 text-white/60 text-xs capitalize">Budget: {budget.replace(/_/g, " ")}</p>
          )}
        </div>
        <div className="absolute right-6 top-6 text-6xl opacity-20">{persona.icon}</div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Visits",    value: summary?.total_visits   ?? 0, icon: "🍽️" },
          { label: "Avg Rating",      value: summary?.avg_overall    ? Number(summary.avg_overall).toFixed(1) : "—", icon: "⭐" },
          { label: "Return Rate",     value: summary?.return_rate    != null ? `${summary.return_rate}%` : "—", icon: "🔁" },
          { label: "Bookings Made",   value: summary?.total_bookings ?? 0, icon: "📅" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-diner-100">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-2xl font-bold text-diner-700">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}
            className="bg-white rounded-2xl p-4 border border-diner-100 shadow-sm hover:border-diner-300 hover:shadow-md transition-all group">
            <span className="text-2xl">{a.icon}</span>
            <p className="font-semibold text-gray-900 text-sm mt-2 group-hover:text-diner-700 transition-colors">{a.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{a.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Welcome card for new users ── */}
      {isNewUser && (
        <div className="bg-gradient-to-br from-diner-50 to-teal-50 rounded-2xl border border-diner-100 p-6">
          <h2 className="font-bold text-diner-800 text-lg mb-1">Welcome to SavoryMind! 🎉</h2>
          <p className="text-diner-600 text-sm mb-4">
            Your personalised dining companion is ready. Start by booking a table or logging a past visit to unlock tailored recommendations.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/diner/book"
              className="inline-flex items-center gap-2 bg-diner-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-diner-700 transition-colors">
              📅 Book a table
            </Link>
            <Link href="/diner/discover"
              className="inline-flex items-center gap-2 bg-white text-diner-700 text-sm font-semibold px-5 py-2.5 rounded-xl border border-diner-200 hover:bg-diner-50 transition-colors">
              🔍 Explore restaurants
            </Link>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming bookings */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-diner-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">📅 Upcoming Bookings</h2>
            <Link href="/diner/book" className="text-xs text-diner-600 font-medium hover:underline">+ Book a table</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-center py-10 px-6">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-gray-500 text-sm mb-4">No upcoming bookings — reserve your next great meal.</p>
              <Link href="/diner/book"
                className="inline-flex bg-diner-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-diner-700 transition-colors">
                Book a table
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {upcoming.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-diner-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-diner-100 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{b.restaurant_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.booking_date} at {b.booking_time} · {b.party_size} guest{b.party_size !== 1 ? "s" : ""}</p>
                    {b.special_requests && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{b.special_requests}</p>}
                  </div>
                  <span className="text-xs font-bold text-diner-700 bg-diner-100 px-2.5 py-1 rounded-full flex-shrink-0 capitalize">{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendations / Top Spots */}
        <div className="bg-white rounded-2xl shadow-sm border border-diner-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">✨ Just For You</h2>
          </div>
          {recs.length === 0 ? (
            <div className="p-6">
              {occasions.length > 0 ? (
                <div className="space-y-3">
                  {occasions.slice(0, 3).map((o) => (
                    <div key={o} className="p-3 rounded-xl bg-diner-50 border border-diner-100">
                      <p className="text-xs font-semibold text-diner-600 capitalize">{o.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500 mt-0.5">We'll find spots perfect for this occasion.</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Log a few visits and we'll personalise your feed.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recs.slice(0, 4).map((r, i) => (
                <div key={i} className="flex items-start gap-3 px-6 py-4 hover:bg-diner-50 transition-colors">
                  <span className="text-xl flex-shrink-0">{r.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent visits ── */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-diner-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">📖 Recent Visits</h2>
            <Link href="/diner/history" className="text-xs text-diner-600 font-medium hover:underline">All visits →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
            {recent.map((v) => (
              <div key={v.id} className="flex items-start gap-4 px-6 py-4 hover:bg-diner-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-diner-100 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{v.restaurant_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{v.visit_date}</p>
                  {v.overall_rating && (
                    <p className="text-amber-500 text-xs mt-1">
                      {"★".repeat(Math.round(v.overall_rating))}{"☆".repeat(5 - Math.round(v.overall_rating))}
                    </p>
                  )}
                  {v.highlights && <p className="text-xs text-diner-600 mt-1 truncate">❤️ {v.highlights}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top spots ── */}
      {summary?.top_restaurants?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-diner-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">🏆 Your Top Spots</h2>
          <div className="flex flex-wrap gap-3">
            {summary.top_restaurants.map((r) => (
              <div key={r.name} className="flex items-center gap-2 bg-diner-50 border border-diner-100 rounded-xl px-4 py-2.5">
                <span className="text-lg">🍽️</span>
                <div>
                  <p className="text-sm font-semibold text-diner-900">{r.name}</p>
                  <p className="text-xs text-diner-600">{r.visits} visit{r.visits !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
