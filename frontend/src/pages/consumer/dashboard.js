import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
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

// Maps a recommendation's deep-link `action` string (see insights/engine.py
// schema) to the real consumer route. Query params are dropped — the target
// pages don't read them — but the user still lands on the right tool.
function recHref(action) {
  const a = (action || "").toLowerCase();
  if (a.startsWith("wine_pairing"))    return "/consumer/wine";
  if (a.startsWith("pairings"))        return "/consumer/beverages";
  if (a.startsWith("music"))           return "/consumer/music";
  if (a.startsWith("explore_recipes")) return "/consumer/explore";
  if (a.startsWith("connections"))     return "/consumer/social";
  return "/consumer/explore";
}

// Mood chips' labelKey lookup happens inside the component so they
// re-translate on language switch (the static export was English-only).
const MOOD_CHIPS = [
  { id: "cozy",        emoji: "🍲", labelKey: "consumerDashboard.moodCozy"        },
  { id: "healthy",     emoji: "🥗", labelKey: "consumerDashboard.moodHealthy"     },
  { id: "adventurous", emoji: "🌶️", labelKey: "consumerDashboard.moodAdventurous" },
  { id: "indulgent",   emoji: "🍝", labelKey: "consumerDashboard.moodIndulgent"   },
  { id: "quick",       emoji: "⚡", labelKey: "consumerDashboard.moodQuick"       },
  { id: "brunch",      emoji: "🥞", labelKey: "consumerDashboard.moodBrunch"      },
];

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [pairings,     setPairings]     = useState([]);
  const [moods,        setMoods]        = useState([]);
  const [recs,         setRecs]         = useState([]);
  const [connections,  setConnections]  = useState([]);
  const [pantry,       setPantry]       = useState([]);
  const [memories,     setMemories]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeMood,   setActiveMood]   = useState("");
  const [suggestion,   setSuggestion]   = useState(null);
  const [suggLoading,  setSuggLoading]  = useState(false);

  useEffect(() => {
    Promise.all([
      api.getWinePairings(),
      api.getMusicMoods(),
      api.getConsumerRecommendations(),
      api.getConnections(),
      api.getPantry(),
      api.getMemories(),
    ])
      .then(([p, m, r, c, pt, mem]) => {
        setPairings(p); setMoods(m); setRecs(r); setConnections(c);
        setPantry(pt); setMemories(mem);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pickMood = async (mood) => {
    const next = activeMood === mood ? "" : mood;
    setActiveMood(next);
    if (!next) { setSuggestion(null); return; }
    setSuggLoading(true);
    try { setSuggestion(await api.getDailySuggestion(next)); }
    catch {}
    finally { setSuggLoading(false); }
  };

  if (loading) return <LoadingSpinner message={t("consumerDashboard.loading")} />;

  const hour         = new Date().getHours();
  const greeting     = hour < 12 ? t("consumerDashboard.goodMorning") : hour < 18 ? t("consumerDashboard.goodAfternoon") : t("consumerDashboard.goodEvening");
  const firstName    = user?.first_name || user?.display_name?.split(" ")[0] || "Chef";
  const persona      = KITCHEN_PERSONAS[user?.kitchen_style] || null;
  const connectedCnt = connections.filter((c) => c.connected).length;
  const cuisines     = pj(user?.cuisine_preferences, []).slice(0, 5);
  const goals        = pj(user?.cooking_goals, []);

  const QUICK_ACTIONS = [
    { href: "/consumer/pantry",  icon: "🧺", label: t("consumerDashboard.qaPantry"),  sub: t("consumerDashboard.qaPantrySub") },
    { href: "/consumer/explore", icon: "✨", label: t("consumerDashboard.qaExplore"), sub: t("consumerDashboard.qaExploreSub") },
    { href: "/consumer/journal", icon: "📔", label: t("consumerDashboard.qaJournal"), sub: t("consumerDashboard.qaJournalSub") },
    { href: "/consumer/wine",    icon: "🍷", label: t("consumerDashboard.qaWine"),    sub: t("consumerDashboard.qaWineSub") },
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
            <p className="mt-3 text-white/70 text-xs">{t("consumerDashboard.loves")}: {cuisines.join(" · ")}</p>
          )}
        </div>
        <div className="absolute right-6 top-6 text-6xl opacity-20">{persona?.icon || "🍽️"}</div>
      </div>

      {/* ── Flavor — SavoryMind's AI voice. Promoted above every other
          dashboard module so it's the first thing users see; previously
          buried in the sidebar quick-links as "Culinary Help". */}
      <Link
        href="/consumer/assistant"
        className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-consumer-600 to-consumer-700 p-5 text-white shadow-sm hover:shadow-md transition-all"
      >
        <span className="text-4xl flex-shrink-0">👨‍🍳</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">{t("consumerDashboard.askFlavor")}</p>
          <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
            {t("consumerDashboard.askFlavorSub")}
          </p>
        </div>
        <span className="text-2xl flex-shrink-0 group-hover:translate-x-1 transition-transform">→</span>
      </Link>

      {/* ── Mood entry widget ── */}
      <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-5">
        <p className="text-sm font-bold text-gray-900 mb-1">{t("consumerDashboard.moodPrompt")}</p>
        <p className="text-xs text-gray-400 mb-4">{t("consumerDashboard.moodSub")}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {MOOD_CHIPS.map((m) => (
            <button key={m.id} onClick={() => pickMood(m.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${
                activeMood === m.id
                  ? "bg-consumer-600 text-white border-consumer-600 shadow-md"
                  : "bg-consumer-50 text-gray-700 border-consumer-200 hover:border-consumer-500 hover:text-consumer-700"
              }`}>
              <span>{m.emoji}</span> {t(m.labelKey)}
            </button>
          ))}
        </div>

        {suggLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <span className="animate-spin">🍽️</span> {t("consumerDashboard.findingDish")}
          </div>
        )}

        {!suggLoading && suggestion && activeMood && (
          <div className="bg-consumer-50 border border-consumer-200 rounded-2xl p-4 flex items-center gap-4">
            <span className="text-4xl flex-shrink-0">{suggestion.suggestion?.image_emoji || "🍽️"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{suggestion.suggestion?.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{suggestion.reason}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs bg-consumer-200 text-consumer-800 px-2 py-0.5 rounded-full">
                  {suggestion.suggestion?.cuisine}
                </span>
                <span className="text-xs text-gray-400">⏱️ {suggestion.suggestion?.time_minutes} min</span>
              </div>
            </div>
            <Link href={suggestion.suggestion?.title
              ? { pathname: "/consumer/explore", query: { q: suggestion.suggestion.title } }
              : "/consumer/explore"}
              className="flex-shrink-0 bg-consumer-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-consumer-700 transition-colors">
              {t("consumerDashboard.cookThis")}
            </Link>
          </div>
        )}
      </div>

      {/* ── Recommended for you — personalized from the onboarding profile,
          behavior and pairing history (insights/engine.py). ── */}
      {recs.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">Recommended for you</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recs.slice(0, 6).map((r, i) => (
              <Link key={i} href={recHref(r.action)}
                className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-4 hover:border-consumer-300 hover:shadow-md transition-all group">
                <span className="text-2xl">{r.icon}</span>
                <p className="font-semibold text-gray-900 text-sm mt-2 group-hover:text-consumer-700 transition-colors">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.body}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("consumerDashboard.mealsLogged"),  value: memories.length, icon: "📔", href: "/consumer/journal" },
          { label: t("consumerDashboard.pantryItems"),  value: pantry.length,   icon: "🧺", href: "/consumer/pantry"  },
          { label: t("consumerDashboard.winePairings"), value: pairings.length, icon: "🍷", href: "/consumer/wine"    },
          { label: t("consumerDashboard.appsConnected"),value: connectedCnt,    icon: "🔗", href: "/consumer/social"  },
        ].map((s) => (
          <Link key={s.label} href={s.href}
            className="bg-white rounded-2xl p-5 shadow-sm border border-consumer-100 hover:border-consumer-300 hover:shadow-md transition-all group">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-2xl font-bold text-consumer-700 group-hover:text-consumer-800">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Link>
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

      {/* ── Going out — diner feature set surfaced inside the unified
          consumer shell. Cards route into the (legacy) /diner/*
          screens which still work for any logged-in user. */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">{t("consumerDashboard.goingOut")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/diner/discover"
            className="bg-gradient-to-br from-diner-50 to-diner-100 border border-diner-200 rounded-2xl p-4 hover:shadow-md transition-all group">
            <span className="text-2xl">🔍</span>
            <p className="font-semibold text-gray-900 text-sm mt-2 group-hover:text-diner-700 transition-colors">{t("consumerDashboard.discoverRest")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("consumerDashboard.discoverRestSub")}</p>
          </Link>
          <Link href="/diner/book"
            className="bg-gradient-to-br from-diner-50 to-diner-100 border border-diner-200 rounded-2xl p-4 hover:shadow-md transition-all group">
            <span className="text-2xl">📅</span>
            <p className="font-semibold text-gray-900 text-sm mt-2 group-hover:text-diner-700 transition-colors">{t("consumerDashboard.myBookings")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("consumerDashboard.myBookingsSub")}</p>
          </Link>
          <Link href="/diner/history"
            className="bg-gradient-to-br from-diner-50 to-diner-100 border border-diner-200 rounded-2xl p-4 hover:shadow-md transition-all group">
            <span className="text-2xl">📖</span>
            <p className="font-semibold text-gray-900 text-sm mt-2 group-hover:text-diner-700 transition-colors">{t("consumerDashboard.visitHistory")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("consumerDashboard.visitHistorySub")}</p>
          </Link>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Wine pairings */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{t("consumerDashboard.recentPairingsTitle")}</h2>
            <Link href="/consumer/wine" className="text-xs text-consumer-600 font-medium hover:underline">{t("consumerDashboard.pairDish")}</Link>
          </div>
          {pairings.length === 0 ? (
            <div className="text-center py-10 px-6">
              <div className="text-4xl mb-3">🍷</div>
              <p className="text-gray-500 text-sm mb-4">{t("consumerDashboard.noPairings")}</p>
              <Link href="/consumer/wine"
                className="inline-flex bg-consumer-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
                {t("consumerDashboard.tryFirstPairing")}
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
                      <p className="text-xs text-gray-400 truncate mt-0.5">{top?.name || t("consumerDashboard.analysing")}</p>
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

        {/* Recent journal entries */}
        <div className="bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{t("consumerDashboard.foodJournal")}</h2>
            <Link href="/consumer/journal" className="text-xs text-consumer-600 font-medium hover:underline">{t("consumerDashboard.viewAll")}</Link>
          </div>
          {memories.length === 0 ? (
            <div className="text-center py-10 px-6">
              <div className="text-4xl mb-3">📔</div>
              <p className="text-gray-500 text-sm mb-4">{t("consumerDashboard.noMemories")}</p>
              <Link href="/consumer/cook"
                className="inline-flex bg-consumer-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
                {t("consumerDashboard.startCooking")}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {memories.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-consumer-50 transition-colors">
                  <span className="text-2xl flex-shrink-0">{m.emoji || "🍽️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{m.dish_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{"⭐".repeat(m.rating)}</p>
                  </div>
                  {m.cuisine && (
                    <span className="text-xs text-consumer-600 bg-consumer-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {m.cuisine}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pantry nudge or Music moods ── */}
      {pantry.length === 0 ? (
        <div className="bg-gradient-to-r from-consumer-50 to-consumer-100 border border-consumer-200 rounded-2xl p-5 flex items-center gap-5">
          <span className="text-4xl flex-shrink-0">🧺</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{t("consumerDashboard.pantryNudgeTitle")}</p>
            <p className="text-sm text-gray-500 mt-0.5">{t("consumerDashboard.pantryNudgeSub")}</p>
          </div>
          <Link href="/consumer/pantry"
            className="flex-shrink-0 bg-consumer-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
            {t("consumerDashboard.addIngredients")}
          </Link>
        </div>
      ) : moods.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{t("consumerDashboard.recentMoodsTitle")}</h2>
            <Link href="/consumer/music" className="text-xs text-consumer-600 font-medium hover:underline">{t("consumerDashboard.setMood")}</Link>
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
