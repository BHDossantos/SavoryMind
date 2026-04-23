import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const KITCHEN_PERSONAS = {
  comfort:     { icon: "🫶", label: "Comfort Cook",    color: "from-amber-400 to-orange-500" },
  adventurer:  { icon: "🌍", label: "The Adventurer",  color: "from-emerald-400 to-teal-500" },
  healthy:     { icon: "🥗", label: "Health Advocate", color: "from-green-400 to-emerald-500" },
  entertainer: { icon: "🥂", label: "The Entertainer", color: "from-purple-400 to-violet-500" },
  speed_cook:  { icon: "⚡", label: "Speed Cook",      color: "from-yellow-400 to-amber-500" },
  baker:       { icon: "🎂", label: "The Baker",       color: "from-pink-400 to-rose-500" },
};

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const [pairings,     setPairings]     = useState([]);
  const [moods,        setMoods]        = useState([]);
  const [recs,         setRecs]         = useState([]);
  const [connections,  setConnections]  = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      api.getWinePairings(),
      api.getMusicMoods(),
      api.getConsumerRecommendations(),
      api.getConnections(),
    ])
      .then(([p, m, r, c]) => { setPairings(p); setMoods(m); setRecs(r); setConnections(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />;

  const hour         = new Date().getHours();
  const greeting     = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName    = user?.first_name || user?.display_name?.split(" ")[0] || "Chef";
  const persona      = KITCHEN_PERSONAS[user?.kitchen_style] || null;
  const connectedCnt = connections.filter((c) => c.connected).length;
  const cuisines     = pj(user?.cuisine_preferences, []).slice(0, 5);
  const goals        = pj(user?.cooking_goals, []);

  const QUICK_ACTIONS = [
    { href: "/consumer/wine",   icon: "🍷", label: "Pair a Wine",     sub: "Match wine to your next dish" },
    { href: "/consumer/music",  icon: "🎵", label: "Set a Mood",      sub: "Pick a cooking soundtrack" },
    { href: "/consumer/recipe", icon: "👨‍🍳", label: "Get a Recipe",    sub: "AI-matched to your style" },
    { href: "/consumer/social", icon: "🔗", label: "Connect Apps",    sub: "Spotify, Vivino & more" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${persona?.color || "from-consumer-500 to-consumer-700"} p-6 text-white`}>
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">{greeting} 👋</p>
          <h1 className="text-2xl font-extrabold">{firstName}</h1>
          {persona && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-1.5">
              <span className="text-lg">{persona.icon}</span>
              <span className="text-sm font-semibold">{persona.label}</span>
            </div>
          )}
          {cuisines.length > 0 && (
            <p className="mt-3 text-white/70 text-xs">Loves: {cuisines.join(" · ")}</p>
          )}
        </div>
        <div className="absolute right-6 top-6 text-6xl opacity-20">{persona?.icon || "🍽️"}</div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Wine Pairings",      value: pairings.length,  icon: "🍷" },
          { label: "Music Moods",        value: moods.length,     icon: "🎵" },
          { label: "Apps Connected",     value: connectedCnt,     icon: "🔗" },
          { label: "AI Recommendations", value: recs.length,      icon: "✨" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-consumer-100">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-2xl font-bold text-consumer-700">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}
            className="bg-white rounded-2xl p-4 border border-consumer-100 shadow-sm hover:border-consumer-300 hover:shadow-md transition-all group">
            <span className="text-2xl">{a.icon}</span>
            <p className="font-semibold text-gray-900 text-sm mt-2 group-hover:text-consumer-700 transition-colors">{a.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{a.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Wine pairings */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">🍷 Recent Wine Pairings</h2>
            <Link href="/consumer/wine" className="text-xs text-consumer-600 font-medium hover:underline">Pair a dish →</Link>
          </div>
          {pairings.length === 0 ? (
            <div className="text-center py-10 px-6">
              <div className="text-4xl mb-3">🍷</div>
              <p className="text-gray-500 text-sm mb-4">No pairings yet — describe a dish and we'll find the perfect wine.</p>
              <Link href="/consumer/wine"
                className="inline-flex bg-consumer-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
                Try your first pairing
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pairings.slice(0, 5).map((p) => {
                const top = p.recommendations?.[0];
                return (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-consumer-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-consumer-100 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{p.dish_name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{top?.name || "Analysing…"}</p>
                    </div>
                    {top && (
                      <span className="text-xs font-bold text-consumer-700 bg-consumer-100 px-2.5 py-1 rounded-full flex-shrink-0">
                        {Math.round((top.confidence || 0) * 100)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Recommendations */}
        <div className="bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">✨ Just For You</h2>
          </div>
          {recs.length === 0 ? (
            <div className="p-6">
              {goals.length > 0 ? (
                <div className="space-y-3">
                  {goals.slice(0, 3).map((g) => (
                    <div key={g} className="p-3 rounded-xl bg-consumer-50 border border-consumer-100">
                      <p className="text-xs font-semibold text-consumer-600 capitalize">{g.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Goal in progress — keep cooking!</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Make a few pairings and we'll personalise your feed.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recs.slice(0, 4).map((r, i) => (
                <div key={i} className="flex items-start gap-3 px-6 py-4 hover:bg-consumer-50 transition-colors">
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

      {/* ── Music moods ── */}
      {moods.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">🎵 Recent Music Moods</h2>
            <Link href="/consumer/music" className="text-xs text-consumer-600 font-medium hover:underline">Set a mood →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
            {moods.slice(0, 3).map((m) => (
              <div key={m.id} className="rounded-xl bg-gradient-to-br from-consumer-500 to-consumer-700 p-4 text-white">
                <p className="text-2xl">{m.recommendations?.emoji || "🎵"}</p>
                <p className="font-bold text-sm capitalize mt-2">{m.mood}</p>
                <p className="text-xs text-consumer-200 mt-0.5 leading-relaxed">{m.recommendations?.vibe}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
