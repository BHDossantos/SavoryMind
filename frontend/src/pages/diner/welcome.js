import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const PRICE_LABELS = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
const STYLE_ICONS = {
  fine_dining: "🕯️", casual_fine: "🍷", bistro: "🥖", casual: "🍔",
  pub: "🍺", cafe: "☕", fast_casual: "🌯",
};

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const FEATURES = [
  {
    icon: "🔍",
    titleKey: "dinerWelcomePage.featDiscoverTitle",
    descKey:  "dinerWelcomePage.featDiscoverDesc",
    href: "/diner/discover",
    ctaKey: "dinerWelcomePage.featDiscoverCta",
    color: "from-diner-500 to-teal-500",
  },
  {
    icon: "📅",
    titleKey: "dinerWelcomePage.featBookTitle",
    descKey:  "dinerWelcomePage.featBookDesc",
    href: "/diner/book",
    ctaKey: "dinerWelcomePage.featBookCta",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: "📖",
    titleKey: "dinerWelcomePage.featVisitsTitle",
    descKey:  "dinerWelcomePage.featVisitsDesc",
    href: "/diner/history",
    ctaKey: "dinerWelcomePage.featVisitsCta",
    color: "from-amber-400 to-orange-500",
  },
];

const BUDGET_KEY = {
  budget: "dinerWelcomePage.budgetFriendly",
  mid: "dinerWelcomePage.midRange",
  luxury: "dinerWelcomePage.luxury",
};

export default function DinerWelcomePage() {
  const { t } = useTranslation();
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
    setBookedMsg(t("dinerWelcomePage.bookedMsg", { name }));
    setTimeout(() => setBookedMsg(""), 5000);
  };

  return (
    <div className="max-w-3xl mx-auto">

      <div className="bg-gradient-to-br from-diner-600 to-teal-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">{t("dinerWelcomePage.welcomeBadge")}</p>
          <h1 className="text-3xl font-extrabold mb-2">{t("dinerWelcomePage.hey", { name: firstName })}</h1>
          <p className="text-white/80 text-base mb-6">{t("dinerWelcomePage.subtitle")}</p>

          <div className="flex flex-wrap gap-2">
            {cuisines.slice(0, 4).map((c) => (
              <span key={c} className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                🍽️ {c}
              </span>
            ))}
            {budget && (
              <span className="bg-white/20 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                💰 {BUDGET_KEY[budget] ? t(BUDGET_KEY[budget]) : budget}
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

      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">{t("dinerWelcomePage.whatYouCanDo")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.href} className="bg-white rounded-2xl border border-diner-100 overflow-hidden hover:shadow-md transition-all group">
              <div className={`h-20 bg-gradient-to-br ${f.color} flex items-center justify-center text-4xl`}>
                {f.icon}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-diner-700 transition-colors">{t(f.titleKey)}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{t(f.descKey)}</p>
                <Link href={f.href}
                  className="text-xs text-diner-600 font-semibold hover:text-diner-800 hover:underline">
                  {t(f.ctaKey)}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">
            {t("dinerWelcomePage.firstPicks")}
            {cuisines.length > 0 && (
              <span className="text-xs font-normal text-diner-600 ml-2">{t("dinerWelcomePage.matchedTo", { cuisine: cuisines[0] })}</span>
            )}
          </h2>
          <Link href="/diner/discover" className="text-xs text-diner-600 font-medium hover:underline">{t("dinerWelcomePage.seeAll")}</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : restaurants.length === 0 ? (
          <div className="bg-diner-50 rounded-2xl border border-diner-100 py-10 text-center">
            <p className="text-gray-400 text-sm">{t("dinerWelcomePage.noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {restaurants.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-diner-100 shadow-sm hover:shadow-md hover:border-diner-300 transition-all overflow-hidden group">
                <div className="h-24 bg-gradient-to-br from-diner-100 to-diner-200 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform">
                  {STYLE_ICONS[r.dining_style] || "🍽️"}
                </div>
                <div className="p-3">
                  <div className="mb-1">
                    <h3 className="font-bold text-gray-900 text-xs leading-tight">{r.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{(r.cuisine || []).slice(0, 2).join(", ")} · {PRICE_LABELS[r.price_level] || "$$"}</p>
                  <button onClick={() => setReserving(r)}
                    className="w-full text-xs bg-diner-600 text-white font-semibold py-1.5 rounded-lg hover:bg-diner-700 transition-colors">
                    {t("dinerWelcomePage.reserve")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(cuisines.length === 0 || !budget) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 mb-6">
          <span className="text-2xl flex-shrink-0">⚡</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{t("dinerWelcomePage.completeProfileTitle")}</p>
            <p className="text-xs text-amber-700 mt-0.5">{t("dinerWelcomePage.completeProfileDesc")}</p>
          </div>
          <Link href="/diner/profile"
            className="flex-shrink-0 text-xs bg-amber-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors">
            {t("dinerWelcomePage.editProfile")}
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-diner-100">
        <p className="text-sm text-gray-400">{t("dinerWelcomePage.revisitNote")}</p>
        <button onClick={() => router.push("/diner/dashboard")}
          className="bg-diner-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-diner-700 transition-colors flex items-center gap-2">
          {t("dinerWelcomePage.letsGo")}
        </button>
      </div>

      {reserving && (
        <BookingModal restaurant={reserving} onClose={() => setReserving(null)} onBooked={handleBooked} />
      )}
    </div>
  );
}

function BookingModal({ restaurant, onClose, onBooked }) {
  const { t } = useTranslation();
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
    if (!form.booking_date) { setError(t("dinerWelcomePage.errDate")); return; }
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
            <h2 className="font-bold text-gray-900">{t("dinerWelcomePage.reserveTable")}</h2>
            <p className="text-sm text-diner-600">{restaurant?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t("dinerWelcomePage.date")}</label>
              <input type="date" value={form.booking_date} min={today}
                onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t("dinerWelcomePage.time")}</label>
              <select value={form.booking_time} onChange={(e) => setForm((f) => ({ ...f, booking_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400">
                {TIMES.map((tm) => <option key={tm}>{tm}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("dinerWelcomePage.partySize")}</label>
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
            rows={2} placeholder={t("dinerWelcomePage.specialPh")}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none" />
          <button type="submit" disabled={loading}
            className="w-full bg-diner-600 text-white font-bold py-3 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {loading ? t("dinerWelcomePage.booking") : t("dinerWelcomePage.confirmReservation")}
          </button>
        </form>
      </div>
    </div>
  );
}
