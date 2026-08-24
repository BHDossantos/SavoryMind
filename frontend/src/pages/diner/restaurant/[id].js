import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";

const STYLE_ICONS = {
  fine_dining: "🕯️", casual_fine: "🍷", bistro: "🥖", casual: "🍔",
  pub: "🍺", cafe: "☕", fast_casual: "🌯",
};
const STYLE_KEY = {
  fine_dining: "discoverPage.styleFineDining",
  casual_fine: "discoverPage.styleCasualFine",
  bistro:      "discoverPage.styleBistro",
  casual:      "discoverPage.styleCasual",
  pub:         "discoverPage.stylePub",
  cafe:        "discoverPage.styleCafe",
  fast_casual: "discoverPage.styleFastCasual",
};
const PRICE_LABELS = { 1: "€", 2: "€€", 3: "€€€", 4: "€€€€" };

const today = () => new Date().toISOString().split("T")[0];

export default function RestaurantProfile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;

  const [restaurant, setRestaurant] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [menu, setMenu] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [showFullMenu, setShowFullMenu] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getRestaurant(id)
      .then(setRestaurant)
      .catch(() => {})
      .finally(() => setLoading(false));
    // Menu + reviews are additive — the profile renders fine without them.
    api.getRestaurantMenu(id).then((m) => setMenu(m.items || [])).catch(() => {});
    api.getRestaurantReviews(id).then(setReviews).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id || !selectedDate) return;
    setSlotsLoading(true);
    api.getAvailability(id, selectedDate)
      .then((d) => setAvailability(d.slots || []))
      .catch(() => setAvailability([]))
      .finally(() => setSlotsLoading(false));
  }, [id, selectedDate]);

  const bookSlot = (time) => {
    router.push(`/diner/book?restaurant_id=${id}&restaurant_name=${encodeURIComponent(restaurant.name)}&date=${selectedDate}&time=${time}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 animate-pulse">{t("restaurantDetailPage.loading")}</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🍽️</p>
        <p className="text-gray-700 font-semibold">{t("restaurantDetailPage.notFound")}</p>
        <button onClick={() => router.push("/diner/discover")} className="mt-4 text-diner-600 font-medium hover:underline">
          {t("restaurantDetailPage.backToDiscover")}
        </button>
      </div>
    );
  }

  const r = restaurant;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
        {t("restaurantDetailPage.back")}
      </button>

      <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-diner-100 flex items-center justify-center text-3xl flex-shrink-0">
            {r.avatar_url
              ? <img src={r.avatar_url} alt={r.name} className="w-full h-full object-cover rounded-2xl" />
              : (STYLE_ICONS[r.dining_style] || "🍽️")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{r.name}</h1>
              <span className="text-sm text-gray-500 font-medium flex-shrink-0">{PRICE_LABELS[r.price_level] || "€€"}</span>
            </div>
            {r.review_count > 0 && (
              <p className="text-sm font-semibold text-amber-600 mt-0.5">
                ★ {r.rating} · {t("restaurantDetailPage.reviewCount", { count: r.review_count })}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-0.5">
              {(r.cuisine || []).join(" · ")}
              {r.city && <span> · 📍 {r.city}{r.country ? `, ${r.country}` : ""}</span>}
            </p>
            {r.street_address && <p className="text-sm text-gray-500 mt-0.5">📍 {r.street_address}</p>}
            {r.opening_hours && <p className="text-sm text-gray-500 mt-0.5">🕐 {r.opening_hours}</p>}
            {r.dining_style && STYLE_KEY[r.dining_style] && (
              <span className="inline-block mt-2 text-xs bg-diner-50 text-diner-700 px-2.5 py-0.5 rounded-full capitalize">
                {t(STYLE_KEY[r.dining_style])}
              </span>
            )}
          </div>
        </div>

        {r.bio && (
          <p className="mt-4 text-gray-600 leading-relaxed">{r.bio}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {r.serves_wine      && <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">{t("restaurantDetailPage.wine")}</span>}
          {r.serves_cocktails && <span className="text-xs bg-pink-50 text-pink-700 px-2.5 py-1 rounded-full">{t("restaurantDetailPage.cocktails")}</span>}
          {r.serves_beer      && <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">{t("restaurantDetailPage.beer")}</span>}
          {r.seating_capacity > 0 && (
            <span className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-full">{t("restaurantDetailPage.seats", { n: r.seating_capacity })}</span>
          )}
          <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
            {t("restaurantDetailPage.booksAhead", { n: r.booking_window_days })}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">{t("restaurantDetailPage.checkAvailability")}</h2>
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-700 mb-1 block">{t("restaurantDetailPage.selectDate")}</label>
          <input
            type="date"
            value={selectedDate}
            min={today()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
          />
        </div>

        {slotsLoading ? (
          <p className="text-sm text-gray-400 animate-pulse">{t("restaurantDetailPage.checking")}</p>
        ) : availability.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3">
            {t("restaurantDetailPage.noSlots")}
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">{t("restaurantDetailPage.slotsAvailable", { count: availability.length })}</p>
            <div className="flex flex-wrap gap-2">
              {availability.map((s) => (
                <button
                  key={s.time}
                  onClick={() => bookSlot(s.time)}
                  className="text-sm px-4 py-2 rounded-xl border border-diner-200 bg-white text-gray-700 font-medium hover:bg-diner-600 hover:text-white hover:border-diner-600 transition-all"
                >
                  {s.time} <span className="text-xs opacity-60">{t("restaurantDetailPage.slotLeft", { n: s.remaining_covers })}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push(`/diner/book?restaurant_id=${id}&restaurant_name=${encodeURIComponent(r.name)}`)}
              className="mt-5 w-full bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 transition-colors"
            >
              {t("restaurantDetailPage.bookTable")}
            </button>
          </>
        )}
      </div>

      {menu.length > 0 && (
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6 mt-5">
          <h2 className="font-semibold text-gray-800 mb-3">{t("restaurantDetailPage.menu")}</h2>
          <div className="divide-y divide-gray-100">
            {(showFullMenu ? menu : menu.slice(0, 8)).map((m) => (
              <div key={m.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                </div>
                <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                  {typeof m.price === "number" ? m.price.toFixed(2) : m.price}
                </span>
              </div>
            ))}
          </div>
          {menu.length > 8 && (
            <button
              onClick={() => setShowFullMenu((v) => !v)}
              className="mt-3 w-full text-sm font-semibold text-diner-600 hover:underline"
            >
              {showFullMenu
                ? t("restaurantDetailPage.showLess")
                : t("restaurantDetailPage.showAllDishes", { count: menu.length })}
            </button>
          )}
        </div>
      )}

      {reviews && reviews.review_count > 0 && (
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6 mt-5">
          <h2 className="font-semibold text-gray-800 mb-3">
            {t("restaurantDetailPage.reviews")} · <span className="text-amber-600">★ {reviews.average_rating}</span> ({reviews.review_count})
          </h2>
          <div className="divide-y divide-gray-100">
            {reviews.reviews.slice(0, 6).map((rv, i) => (
              <div key={i} className="py-3">
                <p className="text-amber-500 text-sm">{"★".repeat(Math.round(rv.rating))}</p>
                {rv.comment && <p className="text-sm text-gray-700 mt-1">{rv.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">{rv.diner_name}{rv.date ? ` · ${rv.date}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
