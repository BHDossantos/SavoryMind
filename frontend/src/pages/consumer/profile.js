import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const KITCHEN_STYLES = [
  { id: "comfort",     icon: "🫶", labelKey: "profilePage.ksComfort" },
  { id: "adventurer",  icon: "🌍", labelKey: "profilePage.ksAdventurer" },
  { id: "healthy",     icon: "🥗", labelKey: "profilePage.ksHealthy" },
  { id: "entertainer", icon: "🥂", labelKey: "profilePage.ksEntertainer" },
  { id: "speed_cook",  icon: "⚡", labelKey: "profilePage.ksSpeedCook" },
  { id: "baker",       icon: "🎂", labelKey: "profilePage.ksBaker" },
];

const SKILL_LEVELS = [
  { id: "beginner",     labelKey: "profilePage.slBeginner" },
  { id: "intermediate", labelKey: "profilePage.slIntermediate" },
  { id: "advanced",     labelKey: "profilePage.slAdvanced" },
  { id: "chef_energy",  labelKey: "profilePage.slChefEnergy" },
];

const COOK_FREQ = [
  { id: "Every day",          labelKey: "profilePage.freqEveryDay" },
  { id: "Weekdays",           labelKey: "profilePage.freqWeekdays" },
  { id: "Weekends only",      labelKey: "profilePage.freqWeekends" },
  { id: "A few times a week", labelKey: "profilePage.freqFewWeek" },
  { id: "Rarely",             labelKey: "profilePage.freqRarely" },
];

const COOK_TIME = [
  { id: "Under 15 min",   labelKey: "profilePage.timeUnder15" },
  { id: "15–30 min",      labelKey: "profilePage.time1530" },
  { id: "30–60 min",      labelKey: "profilePage.time3060" },
  { id: "1–2 hours",      labelKey: "profilePage.time12h" },
  { id: "All day affair", labelKey: "profilePage.timeAllDay" },
];

const ING_BUDGET = [
  { id: "budget",   labelKey: "profilePage.budgetBudget" },
  { id: "moderate", labelKey: "profilePage.budgetModerate" },
  { id: "premium",  labelKey: "profilePage.budgetPremium" },
  { id: "luxury",   labelKey: "profilePage.budgetLuxury" },
];

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
  { id: "meat_lover",     labelKey: "profilePage.dietMeat" },
  { id: "pescatarian",    labelKey: "profilePage.dietPescatarian" },
  { id: "vegetarian",     labelKey: "profilePage.dietVegetarian" },
  { id: "vegan",          labelKey: "profilePage.dietVegan" },
  { id: "gluten_free",    labelKey: "profilePage.dietGluten" },
  { id: "dairy_free",     labelKey: "profilePage.dietDairy" },
  { id: "halal",          labelKey: "profilePage.dietHalal" },
  { id: "kosher",         labelKey: "profilePage.dietKosher" },
  { id: "keto",           labelKey: "profilePage.dietKeto" },
  { id: "no_restriction", labelKey: "profilePage.dietNone" },
];

const COOKING_GOALS = [
  { id: "healthier",  labelKey: "profilePage.goalHealthier" },
  { id: "impress",    labelKey: "profilePage.goalImpress" },
  { id: "save_money", labelKey: "profilePage.goalSaveMoney" },
  { id: "skills",     labelKey: "profilePage.goalSkills" },
  { id: "explore",    labelKey: "profilePage.goalExplore" },
  { id: "meal_prep",  labelKey: "profilePage.goalMealPrep" },
  { id: "family",     labelKey: "profilePage.goalFamily" },
];

const FLAVOR_TYPES = [
  { id: "Sweet",          labelKey: "profilePage.flavorSweet" },
  { id: "Savory",         labelKey: "profilePage.flavorSavory" },
  { id: "Umami",          labelKey: "profilePage.flavorUmami" },
  { id: "Sour / Tangy",   labelKey: "profilePage.flavorSour" },
  { id: "Bitter",         labelKey: "profilePage.flavorBitter" },
  { id: "Smoky",          labelKey: "profilePage.flavorSmoky" },
  { id: "Creamy",         labelKey: "profilePage.flavorCreamy" },
  { id: "Fresh / Light",  labelKey: "profilePage.flavorFresh" },
];

const MUSIC_GENRES = [
  { id: "Pop",        labelKey: "profilePage.genrePop" },
  { id: "Jazz",       labelKey: "profilePage.genreJazz" },
  { id: "Classical",  labelKey: "profilePage.genreClassical" },
  { id: "Hip-Hop",    labelKey: "profilePage.genreHipHop" },
  { id: "R&B",        labelKey: "profilePage.genreRnB" },
  { id: "Electronic", labelKey: "profilePage.genreElectronic" },
  { id: "Indie",      labelKey: "profilePage.genreIndie" },
  { id: "Rock",       labelKey: "profilePage.genreRock" },
  { id: "Latin",      labelKey: "profilePage.genreLatin" },
  { id: "Folk",       labelKey: "profilePage.genreFolk" },
  { id: "Blues",      labelKey: "profilePage.genreBlues" },
  { id: "Country",    labelKey: "profilePage.genreCountry" },
];

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function ChipToggle({ options, value, onChange, className = "" }) {
  const { t } = useTranslation();
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button key={o.id} type="button"
            onClick={() => onChange(active ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-consumer-600 text-white border-consumer-600" : "bg-white text-gray-600 border-gray-200 hover:border-consumer-300"}`}>
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
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${active ? "bg-consumer-600 text-white border-consumer-600" : "bg-white text-gray-600 border-gray-200 hover:border-consumer-300"}`}>
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

const TABS = [
  { id: "basic",    labelKey: "profilePage.tabBasic",    icon: "👤" },
  { id: "kitchen",  labelKey: "profilePage.tabKitchen",  icon: "🍳" },
  { id: "food",     labelKey: "profilePage.tabFood",     icon: "🥗" },
  { id: "goals",    labelKey: "profilePage.tabGoals",    icon: "🎯" },
  { id: "music",    labelKey: "profilePage.tabMusic",    icon: "🎵" },
];

export default function ConsumerProfile() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [basic, setBasic] = useState({
    display_name: user?.display_name || "",
    first_name:   user?.first_name   || "",
    last_name:    user?.last_name    || "",
    city:         user?.city         || "",
    country:      user?.country      || "",
  });

  const [kitchen, setKitchen] = useState({
    kitchen_style:      user?.kitchen_style      || "",
    skill_level:        user?.skill_level        || "",
    cooking_frequency:  user?.cooking_frequency  || "",
    cooking_time_pref:  user?.cooking_time_pref  || "",
    ingredient_budget:  user?.ingredient_budget  || "",
  });

  const [food, setFood] = useState({
    cuisine_preferences: pj(user?.cuisine_preferences, []),
    dietary_preferences: pj(user?.dietary_preferences, []),
    flavor_profile:      pj(user?.flavor_profile, []),
  });

  const [goals, setGoals] = useState({
    cooking_goals: pj(user?.cooking_goals, []),
  });

  const [music, setMusic] = useState({
    music_genres: pj(user?.music_genres, []),
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
      setError(err.message || t("profilePage.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const persona = KITCHEN_STYLES.find((k) => k.id === (kitchen.kitchen_style || user?.kitchen_style));
  const initials = (basic.first_name?.[0] || basic.display_name?.[0] || "U").toUpperCase();

  return (
    <div className="space-y-6">

      <div className="bg-gradient-to-br from-consumer-600 to-consumer-800 rounded-2xl p-6 text-white flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-extrabold">{basic.first_name ? `${basic.first_name} ${basic.last_name}`.trim() : basic.display_name || t("profilePage.yourProfile")}</h1>
          <p className="text-consumer-200 text-sm">{user?.email}</p>
          {persona && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">
              <span>{persona.icon}</span> {t(persona.labelKey)}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-consumer-50 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((tk) => (
          <button key={tk.id} onClick={() => { setTab(tk.id); setSaved(false); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${tab === tk.id ? "bg-white text-consumer-700 shadow-sm" : "text-gray-500 hover:text-consumer-600"}`}>
            {tk.icon} {t(tk.labelKey)}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {saved && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{t("profilePage.savedOk")}</div>}

      {tab === "basic" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-5">
          <h2 className="font-semibold text-gray-800">{t("profilePage.basicTitle")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("profilePage.firstName")}</label>
              <input value={basic.first_name} onChange={(e) => setBasic((b) => ({ ...b, first_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("profilePage.lastName")}</label>
              <input value={basic.last_name} onChange={(e) => setBasic((b) => ({ ...b, last_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("profilePage.displayName")}</label>
            <input value={basic.display_name} onChange={(e) => setBasic((b) => ({ ...b, display_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("profilePage.city")}</label>
              <input value={basic.city} onChange={(e) => setBasic((b) => ({ ...b, city: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("profilePage.country")}</label>
              <input value={basic.country} onChange={(e) => setBasic((b) => ({ ...b, country: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
            </div>
          </div>
          <button onClick={() => save(basic)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? t("profilePage.saving") : t("profilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "kitchen" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">{t("profilePage.kitchenTitle")}</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("profilePage.yourCookingStyle")}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {KITCHEN_STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setKitchen((k) => ({ ...k, kitchen_style: s.id }))}
                  className={`p-3 rounded-xl border text-left transition-all ${kitchen.kitchen_style === s.id ? "border-consumer-500 bg-consumer-50" : "border-gray-200 hover:border-consumer-300"}`}>
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-xs font-semibold text-gray-800 mt-1">{t(s.labelKey)}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.skillLevel")}</label>
            <RadioGroup options={SKILL_LEVELS} value={kitchen.skill_level} onChange={(v) => setKitchen((k) => ({ ...k, skill_level: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.howOften")}</label>
            <RadioGroup options={COOK_FREQ} value={kitchen.cooking_frequency} onChange={(v) => setKitchen((k) => ({ ...k, cooking_frequency: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.timeSpend")}</label>
            <RadioGroup options={COOK_TIME} value={kitchen.cooking_time_pref} onChange={(v) => setKitchen((k) => ({ ...k, cooking_time_pref: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.ingredientBudget")}</label>
            <RadioGroup options={ING_BUDGET} value={kitchen.ingredient_budget} onChange={(v) => setKitchen((k) => ({ ...k, ingredient_budget: v }))} />
          </div>

          <button onClick={() => save(kitchen)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? t("profilePage.saving") : t("profilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "food" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">{t("profilePage.foodTitle")}</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.favCuisines")}</label>
            <ChipToggle options={CUISINES} value={food.cuisine_preferences} onChange={(v) => setFood((f) => ({ ...f, cuisine_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.dietary")}</label>
            <ChipToggle options={DIETARY} value={food.dietary_preferences} onChange={(v) => setFood((f) => ({ ...f, dietary_preferences: v }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.flavourProfile")}</label>
            <ChipToggle options={FLAVOR_TYPES} value={food.flavor_profile} onChange={(v) => setFood((f) => ({ ...f, flavor_profile: v }))} />
          </div>

          <button onClick={() => save(food)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? t("profilePage.saving") : t("profilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "goals" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">{t("profilePage.goalsTitle")}</h2>
          <p className="text-sm text-gray-500">{t("profilePage.goalsSubtitle")}</p>

          <ChipToggle options={COOKING_GOALS} value={goals.cooking_goals} onChange={(v) => setGoals({ cooking_goals: v })} />

          <button onClick={() => save(goals)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? t("profilePage.saving") : t("profilePage.saveChanges")}
          </button>
        </div>
      )}

      {tab === "music" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100 space-y-6">
          <h2 className="font-semibold text-gray-800">{t("profilePage.musicTitle")}</h2>
          <p className="text-sm text-gray-500">{t("profilePage.musicSubtitle")}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("profilePage.favGenres")}</label>
            <ChipToggle options={MUSIC_GENRES} value={music.music_genres} onChange={(v) => setMusic({ music_genres: v })} />
          </div>

          <button onClick={() => save(music)} disabled={saving}
            className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? t("profilePage.saving") : t("profilePage.saveChanges")}
          </button>
        </div>
      )}

    </div>
  );
}
