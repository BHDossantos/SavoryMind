import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const OCCASIONS = [
  { id: "romantic",   labelKey: "dinerProfilePage.occRomantic" },
  { id: "business",   labelKey: "dinerProfilePage.occBusiness" },
  { id: "family",     labelKey: "dinerProfilePage.occFamily" },
  { id: "social",     labelKey: "dinerProfilePage.occSocial" },
  { id: "solo",       labelKey: "dinerProfilePage.occSolo" },
  { id: "celebration",labelKey: "dinerProfilePage.occCelebration" },
  { id: "brunch",     labelKey: "dinerProfilePage.occBrunch" },
  { id: "casual",     labelKey: "dinerProfilePage.occCasual" },
];

const ATMOSPHERES = [
  { id: "fine_dining",  labelKey: "dinerProfilePage.atmFineDining" },
  { id: "bistro",       labelKey: "dinerProfilePage.atmBistro" },
  { id: "casual",       labelKey: "dinerProfilePage.atmCasual" },
  { id: "rooftop",      labelKey: "dinerProfilePage.atmRooftop" },
  { id: "outdoor",      labelKey: "dinerProfilePage.atmOutdoor" },
  { id: "cosy",         labelKey: "dinerProfilePage.atmCosy" },
  { id: "lively",       labelKey: "dinerProfilePage.atmLively" },
  { id: "quiet",        labelKey: "dinerProfilePage.atmQuiet" },
];

const DINING_FREQ = [
  { id: "Every week",          labelKey: "dinerProfilePage.freqEveryWeek" },
  { id: "2–3 times a week",    labelKey: "dinerProfilePage.freq23Week" },
  { id: "Once a week",         labelKey: "dinerProfilePage.freqOnceWeek" },
  { id: "A few times a month", labelKey: "dinerProfilePage.freqFewMonth" },
  { id: "Occasionally",        labelKey: "dinerProfilePage.freqOccasionally" },
];

const DINING_GROUP_OPTS = [
  { id: "Solo",                labelKey: "dinerProfilePage.groupSolo" },
  { id: "Partner",             labelKey: "dinerProfilePage.groupPartner" },
  { id: "Small group (3–5)",   labelKey: "dinerProfilePage.groupSmall" },
  { id: "Large group (6+)",    labelKey: "dinerProfilePage.groupLarge" },
  { id: "Family with kids",    labelKey: "dinerProfilePage.groupFamily" },
];

const BUDGETS = [
  { id: "budget",   labelKey: "dinerProfilePage.budgetBudget" },
  { id: "mid",      labelKey: "dinerProfilePage.budgetMid" },
  { id: "upscale",  labelKey: "dinerProfilePage.budgetUpscale" },
  { id: "luxury",   labelKey: "dinerProfilePage.budgetLuxury" },
];

// Cuisine IDs match the existing profilePage namespace; reuse those keys.
const CUISINES = [
  { id: "Italian",        labelKey: "profilePage.cuisineItalian" },
  { id: "Japanese",       labelKey: "profilePage.cuisineJapanese" },
  { id: "Mexican",        labelKey: "profilePage.cuisineMexican" },
  { id: "French",         labelKey: "profilePage.cuisineFrench" },
  { id: "Indian",         labelKey: "profilePage.cuisineIndian" },
  { id: "American",       labelKey: "profilePage.cuisineAmerican" },
  { id: "Mediterranean",  labelKey: "profilePage.cuisineMediterranean" },
  { id: "Thai",           labelKey: "profilePage.cuisineThai" },
  { id: "Chinese",        labelKey: "profilePage.cuisineChinese" },
  { id: "Greek",          labelKey: "profilePage.cuisineGreek" },
  { id: "Spanish",        labelKey: "profilePage.cuisineSpanish" },
  { id: "Middle Eastern", labelKey: "profilePage.cuisineMiddleEastern" },
  { id: "Korean",         labelKey: "profilePage.cuisineKorean" },
  { id: "Vietnamese",     labelKey: "profilePage.cuisineVietnamese" },
  { id: "Brazilian",      labelKey: "profilePage.cuisineBrazilian" },
  { id: "Moroccan",       labelKey: "profilePage.cuisineMoroccan" },
  { id: "Turkish",        labelKey: "profilePage.cuisineTurkish" },
  { id: "Ethiopian",      labelKey: "profilePage.cuisineEthiopian" },
  { id: "Caribbean",      labelKey: "profilePage.cuisineCaribbean" },
  { id: "Peruvian",       labelKey: "profilePage.cuisinePeruvian" },
  { id: "Lebanese",       labelKey: "profilePage.cuisineLebanese" },
  { id: "Fusion",         labelKey: "profilePage.cuisineFusion" },
];

const DIETARY = [
  { id: "meat_lover",     labelKey: "dinerProfilePage.dietMeat" },
  { id: "pescatarian",    labelKey: "dinerProfilePage.dietPescatarian" },
  { id: "vegetarian",     labelKey: "dinerProfilePage.dietVegetarian" },
  { id: "vegan",          labelKey: "dinerProfilePage.dietVegan" },
  { id: "gluten_free",    labelKey: "dinerProfilePage.dietGluten" },
  { id: "dairy_free",     labelKey: "dinerProfilePage.dietDairy" },
  { id: "halal",          labelKey: "dinerProfilePage.dietHalal" },
  { id: "kosher",         labelKey: "dinerProfilePage.dietKosher" },
  { id: "keto",           labelKey: "dinerProfilePage.dietKeto" },
  { id: "no_restriction", labelKey: "dinerProfilePage.dietNone" },
];

const DRINKS = [
  { id: "wine",        labelKey: "dinerProfilePage.drinkWine" },
  { id: "beer",        labelKey: "dinerProfilePage.drinkBeer" },
  { id: "cocktails",   labelKey: "dinerProfilePage.drinkCocktails" },
  { id: "spirits",     labelKey: "dinerProfilePage.drinkSpirits" },
  { id: "non_alcoholic",labelKey: "dinerProfilePage.drinkNonAlc" },
  { id: "no_alcohol",  labelKey: "dinerProfilePage.drinkNone" },
];

const TABS = [
  { id: "basic",   labelKey: "dinerProfilePage.tabBasic",  icon: "👤" },
  { id: "style",   labelKey: "dinerProfilePage.tabStyle",  icon: "🍽️" },
  { id: "food",    labelKey: "dinerProfilePage.tabFood",   icon: "🥗" },
  { id: "stats",   labelKey: "dinerProfilePage.tabStats",  icon: "📊" },
];

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function ChipToggle({ options, value, onChange }) {
  const { t } = useTranslation();
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button key={o.id} type="button"
            onClick={() => onChange(active ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-diner-600 text-white border-diner-600" : "bg-white text-gray-600 border-gray-200 hover:border-diner-300"}`}>
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

function RadioGroup({ options, value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-diner-600 text-white border-diner-600" : "bg-white text-gray-600 border-gray-200 hover:border-diner-300"}`}>
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

export default function DinerProfile() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [tab,     setTab]     = useState("basic");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => { api.getDinerSummary().then(setSummary).catch(() => {}); }, []);

  const [basic, setBasic] = useState({
    display_name: user?.display_name || "",
    first_name:   user?.first_name   || "",
    last_name:    user?.last_name    || "",
    city:         user?.city         || "",
    country:      user?.country      || "",
  });

  const [style, setStyle] = useState({
    dining_occasions:  pj(user?.dining_occasions,  []),
    atmosphere_prefs:  pj(user?.atmosphere_prefs,  []),
    dining_frequency:  user?.dining_frequency || "",
    dining_group:      pj(user?.dining_group,      []),
    dining_budget:     user?.dining_budget    || "",
  });

  const [food, setFood] = useState({
    cuisine_preferences: pj(user?.cuisine_preferences, []),
    cuisine_dislikes:    pj(user?.cuisine_dislikes,    []),
    dietary_preferences: pj(user?.dietary_preferences, []),
    drinking_habits:     pj(user?.drinking_habits,     []),
    non_alcoholic_ok:    user?.non_alcoholic_ok ?? true,
  });

  const save = async (payload) => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const serialized = {};
      Object.entries(payload).forEach(([k, v]) => {
        serialized[k] = Array.isArray(v) ? JSON.stringify(v) : v;
      });
      const updated = await api.updateProfile(serialized);
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || t("dinerProfilePage.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const initials = (basic.first_name?.[0] || basic.display_name?.[0] || "D").toUpperCase();

  return (
    <div className="space-y-6">

      <div className="bg-gradient-to-br from-diner-600 to-teal-700 rounded-2xl p-6 text-white flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-extrabold">
            {basic.first_name ? `${basic.first_name} ${basic.last_name}`.trim() : basic.display_name || t("dinerProfilePage.yourProfile")}
          </h1>
          <p className="text-diner-200 text-sm">{user?.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {style.dining_occasions.slice(0, 3).map((o) => (
              <span key={o} className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 capitalize">{o.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-diner-50 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((tk) => (
          <button key={tk.id} onClick={() => { setTab(tk.id); setSaved(false); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${tab === tk.id ? "bg-white text-diner-700 shadow-sm" : "text-gray-500 hover:text-diner-600"}`}>
            {tk.icon} {t(tk.labelKey)}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {saved  && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{t("dinerProfilePage.savedOk")}</div>}

      {tab === "basic" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-diner-100 space-y-5">
          <h2 className="font-semibold text-gray-800">{t("dinerProfilePage.basicTitle")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("dinerProfilePage.firstName")}</label>
              <input value={basic.first_name} onChange={(e) => setBasic((b) => ({ ...b, first_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("dinerProfilePage.lastName")}</label>
              <input value={basic.last_name} onChange={(e) => setBasic((b) => ({ ...b, last_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("dinerProfilePage.displayName")}</label>
            <input value={basic.display_name} onChange={(e) => setBasic((b) => ({ ...b, display_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("dinerProfilePage.city")}</label>
              <input value={basic.city} onChange={(e) => setBasic((b) => ({ ...b, city: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("dinerProfilePage.country")}</label>
              <input value={basic.country} onChange={(e) => setBasic((b) => ({ ...b, country: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
            </div>
          </div>
          <button onClick={() => save(basic)} disabled={saving}
            className="bg-diner-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {saving ? t("dinerProfilePage.saving") : t("dinerProfilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "style" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-diner-100 space-y-6">
          <h2 className="font-semibold text-gray-800">{t("dinerProfilePage.styleTitle")}</h2>
          <p className="text-sm text-gray-500 -mt-3">{t("dinerProfilePage.styleSubtitle")}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.diningOccasions")}</label>
            <ChipToggle options={OCCASIONS} value={style.dining_occasions}
              onChange={(v) => setStyle((s) => ({ ...s, dining_occasions: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.atmospherePrefs")}</label>
            <ChipToggle options={ATMOSPHERES} value={style.atmosphere_prefs}
              onChange={(v) => setStyle((s) => ({ ...s, atmosphere_prefs: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.howOften")}</label>
            <RadioGroup options={DINING_FREQ} value={style.dining_frequency}
              onChange={(v) => setStyle((s) => ({ ...s, dining_frequency: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.usuallyWith")}</label>
            <ChipToggle options={DINING_GROUP_OPTS} value={style.dining_group}
              onChange={(v) => setStyle((s) => ({ ...s, dining_group: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.budgetPerPerson")}</label>
            <RadioGroup options={BUDGETS} value={style.dining_budget}
              onChange={(v) => setStyle((s) => ({ ...s, dining_budget: v }))} />
          </div>

          <button onClick={() => save(style)} disabled={saving}
            className="bg-diner-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {saving ? t("dinerProfilePage.saving") : t("dinerProfilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "food" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-diner-100 space-y-6">
          <h2 className="font-semibold text-gray-800">{t("dinerProfilePage.foodTitle")}</h2>
          <p className="text-sm text-gray-500 -mt-3">{t("dinerProfilePage.foodSubtitle")}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.favCuisines")}</label>
            <ChipToggle options={CUISINES} value={food.cuisine_preferences}
              onChange={(v) => setFood((f) => ({ ...f, cuisine_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.cuisinesAvoid")}</label>
            <ChipToggle options={CUISINES} value={food.cuisine_dislikes}
              onChange={(v) => setFood((f) => ({ ...f, cuisine_dislikes: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.dietary")}</label>
            <ChipToggle options={DIETARY} value={food.dietary_preferences}
              onChange={(v) => setFood((f) => ({ ...f, dietary_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("dinerProfilePage.drinks")}</label>
            <ChipToggle options={DRINKS} value={food.drinking_habits}
              onChange={(v) => setFood((f) => ({ ...f, drinking_habits: v }))} />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setFood((f) => ({ ...f, non_alcoholic_ok: !f.non_alcoholic_ok }))}
              className={`w-12 h-6 rounded-full transition-colors ${food.non_alcoholic_ok ? "bg-diner-500" : "bg-gray-200"}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${food.non_alcoholic_ok ? "translate-x-6" : "translate-x-0"}`} />
            </button>
            <span className="text-sm text-gray-700">{t("dinerProfilePage.nonAlcoholicOk")}</span>
          </div>

          <button onClick={() => save(food)} disabled={saving}
            className="bg-diner-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
            {saving ? t("dinerProfilePage.saving") : t("dinerProfilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-4">
          {summary ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { labelKey: "dinerProfilePage.statsTotalVisits",   value: summary.total_visits,   icon: "🍽️" },
                  { labelKey: "dinerProfilePage.statsAvgRating",     value: summary.avg_overall ? Number(summary.avg_overall).toFixed(1) : "—", icon: "⭐" },
                  { labelKey: "dinerProfilePage.statsReturnRate",    value: summary.return_rate != null ? `${summary.return_rate}%` : "—", icon: "🔁" },
                  { labelKey: "dinerProfilePage.statsTotalBookings", value: summary.total_bookings,  icon: "📅" },
                ].map((s) => (
                  <div key={s.labelKey} className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
                    <p className="text-2xl">{s.icon}</p>
                    <p className="text-2xl font-bold text-diner-700 mt-1">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t(s.labelKey)}</p>
                  </div>
                ))}
              </div>

              {summary.top_restaurants?.length > 0 && (
                <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">{t("dinerProfilePage.topSpots")}</h3>
                  <div className="space-y-3">
                    {summary.top_restaurants.map((r, i) => (
                      <div key={r.name} className="flex items-center gap-3">
                        <span className="text-xl">{["🥇","🥈","🥉"][i] || "🍽️"}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{r.name}</p>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                            <div className="bg-diner-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min((r.visits / Math.max(summary.total_visits, 1)) * 100 * 2, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{t("dinerProfilePage.visitsCount", { n: r.visits })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-diner-100 p-10 text-center">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-gray-500">{t("dinerProfilePage.statsEmpty")}</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
