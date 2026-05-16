import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const CRAVINGS = [
  { id: "rich_warm",   emoji: "🍲", labelKey: "orderPage.crRichWarm",   descKey: "orderPage.crRichWarmDesc"   },
  { id: "light_fresh", emoji: "🥗", labelKey: "orderPage.crLightFresh", descKey: "orderPage.crLightFreshDesc" },
  { id: "spicy_bold",  emoji: "🌶️", labelKey: "orderPage.crSpicyBold",  descKey: "orderPage.crSpicyBoldDesc"  },
  { id: "comfort",     emoji: "🍕", labelKey: "orderPage.crComfort",    descKey: "orderPage.crComfortDesc"    },
  { id: "fast_easy",   emoji: "⚡", labelKey: "orderPage.crFastEasy",   descKey: "orderPage.crFastEasyDesc"   },
  { id: "sweet_treat", emoji: "🍰", labelKey: "orderPage.crSweet",      descKey: "orderPage.crSweetDesc"      },
];

const BUDGETS = [
  { id: "",          labelKey: "orderPage.bAny",     subKey: "orderPage.bAnySub"    },
  { id: "budget",    labelKey: "orderPage.bBudget",  subKey: "orderPage.bBudgetSub" },
  { id: "midrange",  labelKey: "orderPage.bMid",     subKey: "orderPage.bMidSub"    },
  { id: "treat",     labelKey: "orderPage.bTreat",   subKey: "orderPage.bTreatSub"  },
];

const DIFF_KEY = { Easy: "orderPage.diffEasy", Medium: "orderPage.diffMedium", Hard: "orderPage.diffHard" };

function Steps({ current }) {
  const { t } = useTranslation();
  const steps = [
    t("orderPage.stepCraving"),
    t("orderPage.stepDish"),
    t("orderPage.stepRestaurant"),
    t("orderPage.stepOrder"),
  ];
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            i <= current ? "bg-consumer-600 text-white" : "bg-consumer-100 text-consumer-400"}`}>
            <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
              {i < current ? "✓" : i + 1}
            </span>
            {s}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 transition-all ${i < current ? "bg-consumer-500" : "bg-consumer-100"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OrderPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep]             = useState(0);
  const [craving, setCraving]       = useState(null);
  const [budget, setBudget]         = useState("");
  const [dishes, setDishes]         = useState([]);
  const [dishLoading, setDishLoading] = useState(false);
  const [dishError, setDishError]   = useState("");
  const [dish, setDish]             = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [restLoading, setRestLoading] = useState(false);
  const [restError, setRestError] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [address, setAddress]       = useState("");
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered]       = useState(false);

  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "there";

  const selectCraving = async (c) => {
    setCraving(c); setDish(null); setRestaurant(null); setDishes([]);
    setDishError(""); setStep(1); setDishLoading(true);
    try {
      const data = await api.getDeliveryDishes(c.id, budget);
      setDishes(data.dishes || []);
      if (!data.dishes?.length) setDishError(t("orderPage.noDishesFound"));
    } catch (e) {
      setDishError(e.message);
    } finally { setDishLoading(false); }
  };

  const selectDish = async (d) => {
    setDish(d); setRestaurant(null); setRestaurants([]);
    setStep(2); setRestLoading(true); setRestError("");
    try {
      const data = await api.getDeliveryRestaurants(d.cuisine);
      setRestaurants(data.restaurants || []);
    } catch (e) { setRestError(e.message || t("orderPage.errLoadRestaurants")); }
    finally { setRestLoading(false); }
  };

  const selectRestaurant = (r) => { setRestaurant(r); setStep(3); };

  const placeOrder = async () => {
    if (!address.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1400));
    setOrdered(true); setSubmitting(false);
  };

  const reset = () => {
    setOrdered(false); setStep(0); setCraving(null); setDish(null);
    setRestaurant(null); setDishes([]); setRestaurants([]);
    setAddress(""); setNote(""); setBudget("");
  };

  const isFree = (fee) => fee === "Free delivery" || fee === t("orderPage.freeDelivery");
  const feeLabel = (fee) => fee === "Free delivery" ? t("orderPage.freeDelivery") : fee;

  if (ordered) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="text-6xl mb-4">🛵</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("orderPage.orderPlaced")}</h2>
        <p className="text-gray-500 mb-2">
          {t("orderPage.orderOnWay", { dish: dish?.name, restaurant: restaurant?.name })}
        </p>
        <p className="text-sm text-gray-400 mb-8">{t("orderPage.estDelivery", { eta: restaurant?.eta })}</p>
        <button onClick={reset}
          className="bg-consumer-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-consumer-700 transition-colors">
          {t("orderPage.orderSomethingElse")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("orderPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("orderPage.greeting", { name: firstName })}</p>
      </div>

      <Steps current={step} />

      {/* Step 0 — Pick a craving */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t("orderPage.hungryFor")}</h2>
          <p className="text-sm text-gray-400 mb-5">{t("orderPage.willFindDishes")}</p>

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">{t("orderPage.budgetLabel")}</span>
            {BUDGETS.map((b) => (
              <button key={b.id} onClick={() => setBudget(b.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                  budget === b.id
                    ? "bg-consumer-600 text-white border-consumer-600"
                    : "bg-white text-gray-600 border-consumer-200 hover:border-consumer-400"}`}>
                {t(b.labelKey)} <span className="opacity-70">{t(b.subKey)}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CRAVINGS.map((c) => (
              <button key={c.id} onClick={() => selectCraving(c)}
                className="text-left bg-white border border-consumer-100 rounded-2xl p-5 hover:border-consumer-500 hover:shadow-md transition-all group">
                <span className="text-3xl block mb-2">{c.emoji}</span>
                <p className="font-bold text-gray-900 text-sm group-hover:text-consumer-700">{t(c.labelKey)}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t(c.descKey)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — Pick a dish */}
      {step === 1 && craving && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(0)} className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">{t("orderPage.back")}</button>
            <div className="flex items-center gap-2 bg-consumer-50 rounded-full px-4 py-1.5">
              <span>{craving.emoji}</span>
              <span className="text-sm font-semibold text-consumer-700">{t(craving.labelKey)}</span>
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">{t("orderPage.chooseDish")}</h2>
          <p className="text-sm text-gray-400 mb-6">{t("orderPage.matchedToCraving")}</p>

          {dishLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : dishError ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-4">{dishError}</p>
              <button onClick={() => setStep(0)} className="text-consumer-600 font-semibold text-sm hover:underline">{t("orderPage.tryAnotherCraving")}</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dishes.map((d) => (
                <button key={d.id} onClick={() => selectDish(d)}
                  className="text-left bg-white border border-consumer-100 rounded-2xl p-5 hover:border-consumer-500 hover:shadow-md transition-all group flex items-center gap-4">
                  <span className="text-4xl flex-shrink-0">{d.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-gray-900 group-hover:text-consumer-700 truncate">{d.name}</p>
                      <span className="text-sm font-bold text-consumer-600 ml-2 flex-shrink-0">{d.price}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{d.cuisine} · {d.time}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-amber-500 font-semibold">★ {d.rating}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.difficulty === "Easy" ? "bg-green-100 text-green-700"
                        : d.difficulty === "Medium" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"}`}>
                        {DIFF_KEY[d.difficulty] ? t(DIFF_KEY[d.difficulty]) : d.difficulty}
                      </span>
                      {d.tags?.slice(0, 1).map((tg) => (
                        <span key={tg} className="text-xs bg-consumer-50 text-consumer-600 px-2 py-0.5 rounded-full">{tg}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Pick a restaurant */}
      {step === 2 && dish && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(1)} className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">{t("orderPage.back")}</button>
            <div className="flex items-center gap-2 bg-consumer-50 rounded-full px-4 py-1.5">
              <span>{dish.emoji}</span>
              <span className="text-sm font-semibold text-consumer-700">{dish.name}</span>
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">{t("orderPage.whoDelivers")}</h2>
          <p className="text-sm text-gray-400 mb-6">{t("orderPage.rankedBy")}</p>

          {restLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : restError ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-4">{restError}</p>
              <button onClick={() => setStep(1)} className="text-consumer-600 font-semibold text-sm hover:underline">{t("orderPage.tryAnotherDish")}</button>
            </div>
          ) : (
            <div className="space-y-3">
              {restaurants.map((r) => (
                <button key={r.id} onClick={() => selectRestaurant(r)}
                  className="w-full text-left bg-white border border-consumer-100 rounded-2xl p-5 hover:border-consumer-500 hover:shadow-md transition-all group flex items-center gap-4">
                  <span className="text-3xl flex-shrink-0">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-900 group-hover:text-consumer-700">{r.name}</p>
                      {r.best_match && (
                        <span className="text-xs bg-consumer-600 text-white px-2 py-0.5 rounded-full font-semibold">{t("orderPage.bestMatch")}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">★ {r.rating} · {t("orderPage.reviewsLabel", { count: r.reviews })} · {r.dist_km} km · {r.eta}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-semibold ${isFree(r.fee) ? "text-green-600" : "text-gray-500"}`}>{feeLabel(r.fee)}</p>
                    <p className="text-xs text-consumer-600 font-bold mt-1 group-hover:underline">{t("orderPage.select")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Confirm & order */}
      {step === 3 && dish && restaurant && (
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(2)} className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">{t("orderPage.back")}</button>
          </div>

          <div className="bg-consumer-50 border border-consumer-200 rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-consumer-600 uppercase tracking-wide mb-3">{t("orderPage.yourOrder")}</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{dish.emoji}</span>
              <div>
                <p className="font-bold text-gray-900">{dish.name}</p>
                <p className="text-xs text-gray-500">{t("orderPage.fromRestaurant", { cuisine: dish.cuisine, restaurant: restaurant.name })}</p>
              </div>
              <span className="ml-auto font-bold text-consumer-700">{dish.price}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-3 border-t border-consumer-200">
              <span>🚗 {restaurant.eta}</span>
              <span>📍 {restaurant.dist_km} km</span>
              <span className={isFree(restaurant.fee) ? "text-green-600 font-semibold" : ""}>{feeLabel(restaurant.fee)}</span>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("orderPage.delivAddress")}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder={t("orderPage.addressPh")}
                className="w-full border border-consumer-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t("orderPage.noteKitchen")} <span className="text-gray-400 font-normal">{t("orderPage.optional")}</span>
              </label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={t("orderPage.notePh")}
                rows={2}
                className="w-full border border-consumer-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
              />
            </div>
          </div>

          <button onClick={placeOrder} disabled={!address.trim() || submitting}
            className="w-full bg-consumer-600 text-white font-bold py-3.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {submitting
              ? <><span className="animate-bounce">🛵</span> {t("orderPage.placingOrder")}</>
              : <>{t("orderPage.placeOrder", { price: dish.price })}</>}
          </button>
        </div>
      )}
    </div>
  );
}
