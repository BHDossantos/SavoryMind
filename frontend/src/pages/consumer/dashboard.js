import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const [pairings, setPairings] = useState([]);
  const [moods, setMoods] = useState([]);
  const [recs, setRecs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getWinePairings(), api.getMusicMoods(), api.getConsumerRecommendations(), api.getConnections()])
      .then(([p, m, r, c]) => { setPairings(p); setMoods(m); setRecs(r); setConnections(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />;

  const connectedCount = connections.filter((c) => c.connected).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{greeting}, {user?.display_name?.split(" ")[0]} 👋</h1>
        <p className="text-gray-400 mt-1">Your personal food & music intelligence hub</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Wine Pairings", value: pairings.length, icon: "🍷", color: "consumer" },
          { label: "Music Moods", value: moods.length, icon: "🎵", color: "consumer" },
          { label: "Services Connected", value: connectedCount, icon: "🔗", color: "consumer" },
          { label: "AI Recommendations", value: recs.length, icon: "✨", color: "consumer" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-consumer-100">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-2xl font-bold text-consumer-700">{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent wine pairings */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">🍷 Recent Wine Pairings</h2>
            <a href="/consumer/wine" className="text-xs text-consumer-600 font-medium hover:underline">Pair a dish →</a>
          </div>
          {pairings.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🍷</div>
              <p className="text-gray-500 text-sm">No pairings yet.</p>
              <a href="/consumer/wine" className="mt-3 inline-block text-sm text-consumer-600 font-medium hover:underline">Try your first pairing</a>
            </div>
          ) : (
            <div className="space-y-3">
              {pairings.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-consumer-50">
                  <span className="text-xl">🍽️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{p.dish_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      Best match: {p.recommendations[0]?.name || "—"}
                    </p>
                  </div>
                  <span className="text-xs text-consumer-600 font-semibold bg-consumer-100 px-2 py-0.5 rounded-full">
                    {Math.round((p.recommendations[0]?.confidence || 0) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendations */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4">✨ For You</h2>
          {recs.length === 0 ? (
            <p className="text-gray-400 text-sm">Make a few pairings and we'll personalise your feed.</p>
          ) : (
            <div className="space-y-3">
              {recs.map((r, i) => (
                <div key={i} className="p-3 rounded-xl border border-consumer-100 hover:bg-consumer-50 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{r.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent music moods */}
      {moods.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">🎵 Recent Music Moods</h2>
            <a href="/consumer/music" className="text-xs text-consumer-600 font-medium hover:underline">Set a mood →</a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {moods.slice(0, 3).map((m) => (
              <div key={m.id} className="p-3 rounded-xl bg-gradient-to-br from-consumer-500 to-consumer-700 text-white">
                <p className="text-lg">{m.recommendations?.emoji || "🎵"}</p>
                <p className="font-semibold text-sm capitalize mt-1">{m.mood}</p>
                <p className="text-xs text-consumer-200">{m.recommendations?.vibe}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
