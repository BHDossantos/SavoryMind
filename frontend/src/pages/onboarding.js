import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh",
  "Belgium","Bolivia","Brazil","Canada","Chile","China","Colombia","Croatia",
  "Czech Republic","Denmark","Ecuador","Egypt","Ethiopia","Finland","France",
  "Germany","Ghana","Greece","Guatemala","Hungary","India","Indonesia","Iran",
  "Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kenya","Lebanon",
  "Malaysia","Mexico","Morocco","Netherlands","New Zealand","Nigeria","Norway",
  "Pakistan","Panama","Peru","Philippines","Poland","Portugal","Romania","Russia",
  "Saudi Arabia","Senegal","Singapore","South Africa","South Korea","Spain",
  "Sri Lanka","Sweden","Switzerland","Thailand","Tunisia","Turkey","Uganda",
  "Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay",
  "Venezuela","Vietnam","Other",
];

const CUISINES = [
  "Italian","Japanese","Mexican","French","Indian","American","Mediterranean",
  "Thai","Chinese","Greek","Spanish","Middle Eastern","Korean","Vietnamese",
  "Brazilian","Moroccan","Turkish","Ethiopian","Caribbean","Peruvian","Lebanese","Fusion",
];

const DIETARY = [
  { id: "meat_lover",     label: "🥩 Meat Lover" },
  { id: "pescatarian",    label: "🐟 Pescatarian" },
  { id: "vegetarian",     label: "🥦 Vegetarian" },
  { id: "vegan",          label: "🌱 Vegan" },
  { id: "gluten_free",    label: "🌾 Gluten-Free" },
  { id: "dairy_free",     label: "🥛 Dairy-Free" },
  { id: "halal",          label: "☪️ Halal" },
  { id: "kosher",         label: "✡️ Kosher" },
  { id: "keto",           label: "🥑 Keto" },
  { id: "low_carb",       label: "📉 Low-Carb" },
  { id: "nut_free",       label: "🥜 Nut-Free" },
  { id: "no_restriction", label: "✅ No restrictions" },
];

const KITCHEN_STYLES = [
  { id: "comfort",     icon: "🫶", title: "Comfort Cook",     sub: "Hearty, soul-warming meals" },
  { id: "adventurer",  icon: "🌍", title: "The Adventurer",   sub: "Bold flavors, global cuisines" },
  { id: "healthy",     icon: "🥗", title: "Health Advocate",  sub: "Clean, nutritious eating" },
  { id: "entertainer", icon: "🥂", title: "The Entertainer",  sub: "Showstopper dinner party dishes" },
  { id: "speed_cook",  icon: "⚡", title: "Speed Cook",       sub: "Delicious in 30 min or less" },
  { id: "baker",       icon: "🎂", title: "The Baker",        sub: "Breads, pastries, the science of baking" },
];

const SKILL_LEVELS = [
  { id: "beginner",     label: "Beginner",    sub: "Still learning the basics" },
  { id: "intermediate", label: "Intermediate",sub: "Comfortable in the kitchen" },
  { id: "advanced",     label: "Advanced",    sub: "Confident with complex techniques" },
  { id: "chef_energy",  label: "Chef Energy", sub: "Professional-level skills" },
];

const COOK_FREQ  = ["Every day","Weekdays","Weekends only","A few times a week","Rarely"];
const COOK_TIME  = ["Under 15 min","15–30 min","30–60 min","1–2 hours","All day affair"];

const ING_BUDGET = [
  { id: "budget",   label: "💰 Budget",   sub: "Great food, low cost" },
  { id: "moderate", label: "🍽️ Moderate", sub: "Quality ingredients" },
  { id: "premium",  label: "⭐ Premium",  sub: "Best available" },
  { id: "luxury",   label: "💎 Luxury",   sub: "No limits" },
];

const PROTEINS     = ["Chicken","Beef","Pork","Lamb","Fish","Seafood","Tofu","Eggs","Legumes","Turkey"];
const SPICE_LEVELS = ["Mild","Medium","Spicy","Extra hot","No preference"];
const FLAVOR_TYPES = ["Sweet","Savory","Umami","Sour / Tangy","Bitter","Smoky","Creamy","Fresh / Light"];

const COOKING_GOALS = [
  { id: "healthier",  label: "🥗 Eat healthier" },
  { id: "impress",    label: "🎉 Impress guests" },
  { id: "save_money", label: "💰 Save money" },
  { id: "skills",     label: "📈 Improve skills" },
  { id: "explore",    label: "🌍 Explore cuisines" },
  { id: "meal_prep",  label: "📦 Meal prep" },
  { id: "family",     label: "👨‍👩‍👧 Cook for family" },
  { id: "comfort",    label: "🫶 Comfort meals" },
];

const MEAL_TYPES = [
  { id: "romantic",     label: "💑 Romantic dinners" },
  { id: "weeknight",    label: "🍳 Quick weeknight meals" },
  { id: "brunch",       label: "🥐 Weekend brunch" },
  { id: "entertaining", label: "🎉 Entertaining guests" },
  { id: "solo",         label: "🧘 Solo self-care" },
  { id: "meal_prep",    label: "🥙 Work lunch / meal prep" },
  { id: "seasonal",     label: "🍂 Seasonal celebrations" },
  { id: "healthy",      label: "💪 Health-focused meals" },
];

const KITCHEN_TOOLS = [
  "Oven","Stovetop","Air fryer","Instant Pot","Stand mixer","Food processor",
  "Cast iron skillet","Wok","Grill / BBQ","Sous vide","Blender","Rice cooker",
  "Slow cooker","Dutch oven","Pizza stone",
];

const MUSIC_GENRES = [
  "Jazz","Classical","Pop","R&B / Soul","Rock","Hip-Hop","Country","Electronic",
  "Latin","Folk","Blues","World Music","Reggae","Indie","Funk","Gospel",
];

const MUSIC_MOODS = [
  { id: "romantic",  label: "💑 Romantic" },
  { id: "relaxed",   label: "😌 Relaxed" },
  { id: "energetic", label: "⚡ Energetic" },
  { id: "focus",     label: "🎯 Focus" },
  { id: "festive",   label: "🎉 Festive" },
  { id: "cozy",      label: "🕯️ Cozy" },
  { id: "upbeat",    label: "🕺 Upbeat" },
  { id: "chill",     label: "🌊 Chill" },
];

const DRINK_TYPES = [
  { id: "wine",      label: "🍷 Wine",      sub: "Red, white, rosé, sparkling" },
  { id: "beer",      label: "🍺 Beer",      sub: "Craft, lager, IPA, stout" },
  { id: "spirits",   label: "🥃 Spirits",   sub: "Whiskey, rum, gin, tequila" },
  { id: "cocktails", label: "🍸 Cocktails", sub: "Classic, modern, mocktails" },
];
const DRINK_FREQS = ["Never","Occasionally","Regularly","Often"];

// ─── Diner constants ──────────────────────────────────────────────────────────

const DINING_OCCASIONS = [
  { id: "romantic",    label: "💑 Romantic dinners" },
  { id: "business",    label: "💼 Business lunches" },
  { id: "friends",     label: "👯 Nights out with friends" },
  { id: "family",      label: "👨‍👩‍👧 Family gatherings" },
  { id: "solo",        label: "🧘 Solo dining" },
  { id: "wine_dining", label: "🍷 Wine & fine dining" },
  { id: "brunch",      label: "🥐 Brunch dates" },
  { id: "celebration", label: "🎉 Special celebrations" },
];

const ATMOSPHERE_PREFS = [
  { id: "romantic",   label: "💑 Romantic" },
  { id: "elegant",    label: "✨ Elegant" },
  { id: "cozy",       label: "🕯️ Cozy & intimate" },
  { id: "lively",     label: "🎉 Lively & social" },
  { id: "outdoor",    label: "🌿 Outdoor terrace" },
  { id: "rooftop",    label: "🏙️ Rooftop views" },
  { id: "casual",     label: "👕 Casual & relaxed" },
  { id: "hidden_gem", label: "🚪 Hidden gems" },
];

const DINING_BUDGETS = [
  { id: "budget",   label: "💰 Budget",   sub: "Under €30 per person" },
  { id: "moderate", label: "🍽️ Moderate", sub: "€30–60 per person" },
  { id: "premium",  label: "⭐ Premium",  sub: "€60–120 per person" },
  { id: "luxury",   label: "💎 Luxury",   sub: "€120+ per person" },
];

const DINING_GROUPS = [
  { id: "solo",     label: "🧘 Solo" },
  { id: "couple",   label: "💑 As a couple" },
  { id: "friends",  label: "👯 With friends" },
  { id: "family",   label: "👨‍👩‍👧 With family" },
  { id: "business", label: "💼 For business" },
  { id: "large",    label: "🎉 Large groups" },
];

const DINING_FREQS = [
  { id: "daily",        label: "Every day" },
  { id: "weekly",       label: "A few times a week" },
  { id: "biweekly",     label: "Once or twice a week" },
  { id: "occasionally", label: "A few times a month" },
  { id: "rarely",       label: "Rarely" },
];

// Diner colour lookup
const DC = {
  chip:      "bg-diner-600 text-white border-diner-600",
  chipHover: "hover:border-diner-300",
  ring:      "focus:ring-diner-400",
  cardSel:   "border-diner-500 bg-diner-50",
  progress:  "bg-diner-500",
  dot:       "bg-diner-500",
};

// ─── Restaurant constants ─────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { id: "restaurant",  icon: "🍽️", label: "Restaurant" },
  { id: "bar",         icon: "🍸", label: "Bar / Cocktail Lounge" },
  { id: "cafe",        icon: "☕", label: "Café / Bistro" },
  { id: "fine_dining", icon: "✨", label: "Fine Dining" },
  { id: "fast_casual", icon: "⚡", label: "Fast Casual" },
  { id: "food_truck",  icon: "🚚", label: "Food Truck / Pop-up" },
  { id: "bakery",      icon: "🥐", label: "Bakery / Patisserie" },
  { id: "wine_bar",    icon: "🍷", label: "Wine Bar / Winery" },
];

const DINING_STYLES = [
  { id: "fine_dining",  label: "✨ Fine Dining",    sub: "White-tablecloth, tasting menus" },
  { id: "casual",       label: "😊 Casual Dining",  sub: "Relaxed, everyday experience" },
  { id: "fast_casual",  label: "⚡ Fast Casual",    sub: "Quick service, quality food" },
  { id: "tasting_menu", label: "🎭 Tasting Menu",   sub: "Chef-driven multi-course journey" },
  { id: "family_style", label: "👨‍👩‍👧 Family Style",  sub: "Shared dishes, communal eating" },
  { id: "bar_bites",    label: "🍺 Bar & Bites",    sub: "Drinks-first with great food" },
];

const SERVICE_TYPES  = ["Dine-in","Takeout","Delivery","Catering","Private events"];

const REST_AUDIENCE = [
  { id: "couples",  label: "💑 Couples" },
  { id: "families", label: "👨‍👩‍👧 Families" },
  { id: "business", label: "💼 Business" },
  { id: "tourists", label: "✈️ Tourists" },
  { id: "foodies",  label: "🍴 Foodies" },
  { id: "young",    label: "🎉 Young crowd" },
  { id: "luxury",   label: "💎 Luxury seekers" },
  { id: "locals",   label: "🏘️ Local regulars" },
];

const PEAK_HOURS = [
  { id: "breakfast",  label: "🌅 Breakfast (7–10am)" },
  { id: "brunch",     label: "🥐 Brunch (10am–1pm)" },
  { id: "lunch",      label: "☀️ Lunch (12–3pm)" },
  { id: "afternoon",  label: "🍵 Afternoon (3–6pm)" },
  { id: "dinner",     label: "🌙 Dinner (6–10pm)" },
  { id: "late_night", label: "🌃 Late Night (10pm+)" },
];

const REST_GOALS = [
  { id: "reduce_waste", label: "♻️ Reduce food waste" },
  { id: "loyalty",      label: "🔁 Build customer loyalty" },
  { id: "upsell",       label: "📈 Increase average spend" },
  { id: "staff",        label: "👥 Better staff management" },
  { id: "reviews",      label: "⭐ Improve online reviews" },
  { id: "menu_opt",     label: "🍽️ Optimise my menu" },
  { id: "sentiment",    label: "💬 Understand customers" },
  { id: "wine_pairing", label: "🍷 Elevate wine program" },
];

const WINE_PROGRAM_OPTS = [
  "Red wines","White wines","Rosé","Sparkling / Champagne",
  "Natural wines","Orange wines","Dessert wines",
];

// Restaurant colour lookup
const RC = {
  chip:      "bg-brand-600 text-white border-brand-600",
  chipHover: "hover:border-brand-300",
  ring:      "focus:ring-brand-400",
  cardSel:   "border-brand-500 bg-brand-50",
  progress:  "bg-brand-500",
  dot:       "bg-brand-500",
};

const ACCOUNT_TYPES = [
  { id: "consumer",   icon: "🏠", title: "Home Cook",        sub: "Wine pairings, music moods & recipe recommendations", border: "border-consumer-500", bg: "bg-consumer-50", check: "text-consumer-600" },
  { id: "diner",      icon: "🍽️", title: "Food Explorer",    sub: "Restaurant discovery, visit history & dining memories", border: "border-diner-500",    bg: "bg-diner-50",    check: "text-diner-600" },
  { id: "restaurant", icon: "🏪", title: "Restaurant Owner", sub: "Analytics, CRM, staff management & business insights", border: "border-brand-500",    bg: "bg-brand-50",    check: "text-brand-600" },
];

// ─── Tailwind static colour lookup (no dynamic interpolation) ─────────────────
const CC = {
  chip:      "bg-consumer-600 text-white border-consumer-600",
  chipHover: "hover:border-consumer-300",
  ring:      "focus:ring-consumer-400",
  cardSel:   "border-consumer-500 bg-consumer-50",
  progress:  "bg-consumer-500",
  dot:       "bg-consumer-500",
  text:      "text-consumer-700",
  subtle:    "bg-consumer-50 border-consumer-100",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function ChipSelect({ items, selected, onToggle, activeClass = CC.chip, hoverClass = CC.chipHover }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const val   = typeof item === "string" ? item : item.id;
        const label = typeof item === "string" ? item : item.label;
        const on    = selected.includes(val);
        return (
          <button key={val} type="button" onClick={() => onToggle(val)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${on ? activeClass : `bg-white text-gray-600 border-gray-200 ${hoverClass}`}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function RadioCards({ items, selected, onSelect, cols = 1 }) {
  return (
    <div className={cols === 2 ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelect(item.id)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${selected === item.id ? CC.cardSel : "border-gray-200 bg-white hover:border-gray-300"}`}>
          {item.icon && <span className="text-2xl flex-shrink-0">{item.icon}</span>}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{item.label || item.title}</p>
            {item.sub && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
          </div>
          {selected === item.id && <span className="text-consumer-600 ml-1 font-bold">✓</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Shared steps ─────────────────────────────────────────────────────────────

function StepAccountType({ data, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4">This shapes your entire experience — pick the one that fits you best.</p>
      {ACCOUNT_TYPES.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange("account_type", t.id)}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.account_type === t.id ? `${t.border} ${t.bg}` : "border-gray-200 hover:border-gray-300 bg-white"}`}>
          <span className="text-3xl">{t.icon}</span>
          <div>
            <p className="font-bold text-gray-900">{t.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{t.sub}</p>
          </div>
          {data.account_type === t.id && <span className={`ml-auto text-lg ${t.check}`}>✓</span>}
        </button>
      ))}
    </div>
  );
}

function StepName({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name</label>
        <input value={data.first_name} onChange={(e) => onChange("first_name", e.target.value)}
          placeholder="Your first name"
          className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${CC.ring}`} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
        <input value={data.last_name} onChange={(e) => onChange("last_name", e.target.value)}
          placeholder="Your last name"
          className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${CC.ring}`} />
      </div>
    </div>
  );
}

function StepLocation({ data, onChange }) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError,   setGeoError]   = useState(null);
  const detect = () => {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
    setGeoLoading(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange("latitude", p.coords.latitude); onChange("longitude", p.coords.longitude); setGeoLoading(false); },
      ()  => { setGeoError("Couldn't get location."); setGeoLoading(false); }
    );
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">City</label>
        <input value={data.city} onChange={(e) => onChange("city", e.target.value)}
          placeholder="e.g. Rome, New York, Tokyo…"
          className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${CC.ring}`} />
        <p className="text-xs text-gray-400 mt-1">Used for nearby restaurant recommendations.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Country</label>
        <select value={data.country} onChange={(e) => onChange("country", e.target.value)}
          className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 ${CC.ring}`}>
          <option value="">Select your country…</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-1">📍 Precise location <span className="font-normal text-gray-400">(optional)</span></p>
        <p className="text-xs text-gray-400 mb-3">Allows hyper-local restaurant recommendations near you.</p>
        {data.latitude
          ? <p className="text-xs text-green-600 font-medium">✓ Location captured ({data.latitude.toFixed(4)}, {data.longitude.toFixed(4)})</p>
          : <>
              <button type="button" onClick={detect} disabled={geoLoading}
                className="text-sm bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                {geoLoading ? "Detecting…" : "Use My Location"}
              </button>
              {geoError && <p className="text-xs text-red-500 mt-2">{geoError}</p>}
            </>
        }
      </div>
    </div>
  );
}

// ─── Consumer steps 1–5 ──────────────────────────────────────────────────────

function StepKitchenStyle({ data, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-2">Pick the one that best describes how you cook.</p>
      {KITCHEN_STYLES.map((s) => (
        <button key={s.id} type="button" onClick={() => onChange("kitchen_style", s.id)}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.kitchen_style === s.id ? CC.cardSel : "border-gray-200 bg-white hover:border-gray-300"}`}>
          <span className="text-3xl">{s.icon}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-900">{s.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.sub}</p>
          </div>
          {data.kitchen_style === s.id && <span className="text-consumer-600 font-bold text-lg">✓</span>}
        </button>
      ))}
    </div>
  );
}

function StepCookingHabits({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">What's your skill level?</p>
        <RadioCards items={SKILL_LEVELS} selected={data.skill_level} onSelect={(v) => onChange("skill_level", v)} cols={2} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">How often do you cook?</p>
        <div className="flex flex-wrap gap-2">
          {COOK_FREQ.map((f) => (
            <button key={f} type="button" onClick={() => onChange("cooking_frequency", f)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${data.cooking_frequency === f ? CC.chip : `bg-white text-gray-600 border-gray-200 ${CC.chipHover}`}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">How long do you typically cook?</p>
        <div className="flex flex-wrap gap-2">
          {COOK_TIME.map((t) => (
            <button key={t} type="button" onClick={() => onChange("cooking_time_pref", t)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${data.cooking_time_pref === t ? CC.chip : `bg-white text-gray-600 border-gray-200 ${CC.chipHover}`}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Ingredient budget?</p>
        <RadioCards items={ING_BUDGET} selected={data.ingredient_budget} onSelect={(v) => onChange("ingredient_budget", v)} cols={2} />
      </div>
    </div>
  );
}

function StepCuisines({ data, onChange }) {
  const loved    = pj(data.cuisine_preferences, []);
  const disliked = pj(data.cuisine_dislikes, []);
  const toggleLove    = (c) => onChange("cuisine_preferences", JSON.stringify(loved.includes(c) ? loved.filter((x) => x !== c) : [...loved, c]));
  const toggleDislike = (c) => onChange("cuisine_dislikes",    JSON.stringify(disliked.includes(c) ? disliked.filter((x) => x !== c) : [...disliked, c]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Which cuisines do you love? <span className="font-normal text-gray-400">(pick all that apply)</span></p>
        <ChipSelect items={CUISINES} selected={loved} onToggle={toggleLove} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Any cuisines you'd rather avoid? <span className="font-normal text-gray-400">(optional)</span></p>
        <ChipSelect items={CUISINES} selected={disliked} onToggle={toggleDislike}
          activeClass="bg-red-100 text-red-700 border-red-300" hoverClass="hover:border-red-200" />
      </div>
    </div>
  );
}

function StepFlavor({ data, onChange }) {
  const fp = pj(data.flavor_profile, { proteins: [], spice_level: "", flavor_types: [] });
  const update = (key, val) => onChange("flavor_profile", JSON.stringify({ ...fp, [key]: val }));
  const toggleArr = (key, val) => {
    const arr = fp[key] || [];
    update(key, arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Favourite proteins <span className="font-normal text-gray-400">(pick all)</span></p>
        <ChipSelect items={PROTEINS} selected={fp.proteins} onToggle={(v) => toggleArr("proteins", v)} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Spice tolerance?</p>
        <div className="flex flex-wrap gap-2">
          {SPICE_LEVELS.map((s) => (
            <button key={s} type="button" onClick={() => update("spice_level", s)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${fp.spice_level === s ? CC.chip : `bg-white text-gray-600 border-gray-200 ${CC.chipHover}`}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Favourite flavour profiles <span className="font-normal text-gray-400">(pick all)</span></p>
        <ChipSelect items={FLAVOR_TYPES} selected={fp.flavor_types} onToggle={(v) => toggleArr("flavor_types", v)} />
      </div>
    </div>
  );
}

function StepDietGoals({ data, onChange }) {
  const diet  = pj(data.dietary_preferences, []);
  const goals = pj(data.cooking_goals, []);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Dietary preferences</p>
        <ChipSelect items={DIETARY} selected={diet}
          onToggle={(v) => onChange("dietary_preferences", JSON.stringify(diet.includes(v) ? diet.filter((x) => x !== v) : [...diet, v]))} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Cooking goals <span className="font-normal text-gray-400">(pick all that apply)</span></p>
        <ChipSelect items={COOKING_GOALS} selected={goals}
          onToggle={(v) => onChange("cooking_goals", JSON.stringify(goals.includes(v) ? goals.filter((x) => x !== v) : [...goals, v]))} />
      </div>
    </div>
  );
}

// ─── Consumer steps 6–11 ─────────────────────────────────────────────────────

function StepDrinks({ data, onChange }) {
  const habits = pj(data.drinking_habits, {});
  const setFreq = (type, freq) => onChange("drinking_habits", JSON.stringify({ ...habits, [type]: freq }));
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Helps us pair the right drinks with your meals.</p>
      {DRINK_TYPES.map((dt) => (
        <div key={dt.id}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{dt.label.split(" ")[0]}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{dt.label.split(" ").slice(1).join(" ")}</p>
              <p className="text-xs text-gray-400">{dt.sub}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {DRINK_FREQS.map((f) => (
              <button key={f} type="button" onClick={() => setFreq(dt.id, f.toLowerCase())}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${habits[dt.id] === f.toLowerCase() ? CC.chip : `bg-white text-gray-500 border-gray-200 ${CC.chipHover}`}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      ))}
      <label className="flex items-center gap-3 cursor-pointer pt-2">
        <input type="checkbox"
          checked={!!data.non_alcoholic_ok}
          onChange={(e) => onChange("non_alcoholic_ok", e.target.checked)}
          className="w-4 h-4 rounded border-gray-300" />
        <span className="text-sm text-gray-700">Also show non-alcoholic alternatives</span>
      </label>
    </div>
  );
}

function StepMusic({ data, onChange }) {
  const genres = pj(data.music_genres, []);
  const moods  = pj(data.music_moods,  []);
  const toggleGenre = (g) => onChange("music_genres", JSON.stringify(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]));
  const toggleMood  = (m) => onChange("music_moods",  JSON.stringify(moods.includes(m)  ? moods.filter((x) => x !== m)  : [...moods, m]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Music genres you love</p>
        <ChipSelect items={MUSIC_GENRES} selected={genres} onToggle={toggleGenre} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Cooking / dining moods <span className="font-normal text-gray-400">(pick all)</span></p>
        <ChipSelect items={MUSIC_MOODS} selected={moods} onToggle={toggleMood} />
      </div>
    </div>
  );
}

function StepMealTypes({ data, onChange }) {
  const selected = pj(data.meal_types, []);
  const toggle   = (v) => onChange("meal_types", JSON.stringify(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Pick everything that sounds like you.</p>
      <div className="grid grid-cols-2 gap-2">
        {MEAL_TYPES.map((m) => (
          <button key={m.id} type="button" onClick={() => toggle(m.id)}
            className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${selected.includes(m.id) ? CC.chip : `bg-white text-gray-600 border-gray-200 ${CC.chipHover}`}`}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepKitchenTools({ data, onChange }) {
  const selected = pj(data.kitchen_tools, []);
  const toggle   = (v) => onChange("kitchen_tools", JSON.stringify(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">What do you have in your kitchen?</p>
      <ChipSelect items={KITCHEN_TOOLS} selected={selected} onToggle={toggle} />
    </div>
  );
}

function StepConsumerSummary({ data }) {
  const style   = KITCHEN_STYLES.find((s) => s.id === data.kitchen_style);
  const skill   = SKILL_LEVELS.find((s) => s.id === data.skill_level);
  const cuisines = pj(data.cuisine_preferences, []).slice(0, 4);
  const goals    = pj(data.cooking_goals, []).slice(0, 3);
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-consumer-100 text-4xl mx-auto">
        {style?.icon || "🍽️"}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-consumer-500 mb-1">Your Culinary Identity</p>
        <h2 className="text-2xl font-extrabold text-gray-900">{style?.title || "Home Cook"}</h2>
        <p className="text-gray-500 text-sm mt-1">{style?.sub}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        {skill && (
          <div className="bg-consumer-50 border border-consumer-100 rounded-xl p-3">
            <p className="text-xs text-consumer-500 font-semibold uppercase tracking-wide">Skill</p>
            <p className="font-bold text-gray-800 mt-0.5">{skill.label}</p>
          </div>
        )}
        {data.ingredient_budget && (
          <div className="bg-consumer-50 border border-consumer-100 rounded-xl p-3">
            <p className="text-xs text-consumer-500 font-semibold uppercase tracking-wide">Budget</p>
            <p className="font-bold text-gray-800 mt-0.5 capitalize">{data.ingredient_budget}</p>
          </div>
        )}
        {cuisines.length > 0 && (
          <div className="bg-consumer-50 border border-consumer-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-consumer-500 font-semibold uppercase tracking-wide mb-1">Top Cuisines</p>
            <p className="text-sm text-gray-700">{cuisines.join(" · ")}</p>
          </div>
        )}
        {goals.length > 0 && (
          <div className="bg-consumer-50 border border-consumer-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-consumer-500 font-semibold uppercase tracking-wide mb-1">Goals</p>
            <div className="flex flex-wrap gap-1">
              {goals.map((g) => {
                const found = COOKING_GOALS.find((x) => x.id === g);
                return <span key={g} className="text-xs bg-white border border-consumer-200 text-consumer-700 px-2 py-0.5 rounded-full">{found?.label || g}</span>;
              })}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-400">SavoryMind will now personalise everything for you 🎉</p>
    </div>
  );
}

// ─── Diner step components ────────────────────────────────────────────────────

function StepDiningOccasions({ data, onChange }) {
  const selected = pj(data.dining_occasions, []);
  const toggle   = (v) => onChange("dining_occasions", JSON.stringify(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">When do you typically go out to eat?</p>
      <div className="grid grid-cols-2 gap-2">
        {DINING_OCCASIONS.map((o) => (
          <button key={o.id} type="button" onClick={() => toggle(o.id)}
            className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${selected.includes(o.id) ? DC.chip : `bg-white text-gray-600 border-gray-200 ${DC.chipHover}`}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDinerCuisines({ data, onChange }) {
  const loved    = pj(data.cuisine_preferences, []);
  const toggle   = (c) => onChange("cuisine_preferences", JSON.stringify(loved.includes(c) ? loved.filter((x) => x !== c) : [...loved, c]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Which cuisines do you love eating out for?</p>
      <ChipSelect items={CUISINES} selected={loved} onToggle={toggle}
        activeClass={DC.chip} hoverClass={DC.chipHover} />
    </div>
  );
}

function StepTastePrefs({ data, onChange }) {
  const diet   = pj(data.dietary_preferences, []);
  const toggle = (v) => onChange("dietary_preferences", JSON.stringify(diet.includes(v) ? diet.filter((x) => x !== v) : [...diet, v]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Any dietary preferences or restrictions?</p>
      <div className="grid grid-cols-2 gap-2">
        {DIETARY.map((d) => (
          <button key={d.id} type="button" onClick={() => toggle(d.id)}
            className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${diet.includes(d.id) ? DC.chip : `bg-white text-gray-600 border-gray-200 ${DC.chipHover}`}`}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepAtmosphere({ data, onChange }) {
  const selected = pj(data.atmosphere_prefs, []);
  const toggle   = (v) => onChange("atmosphere_prefs", JSON.stringify(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">What kind of atmosphere do you prefer?</p>
      <div className="grid grid-cols-2 gap-2">
        {ATMOSPHERE_PREFS.map((a) => (
          <button key={a.id} type="button" onClick={() => toggle(a.id)}
            className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${selected.includes(a.id) ? DC.chip : `bg-white text-gray-600 border-gray-200 ${DC.chipHover}`}`}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDiningBudget({ data, onChange }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">What's your typical dining budget per person?</p>
      <div className="grid grid-cols-1 gap-3">
        {DINING_BUDGETS.map((b) => (
          <button key={b.id} type="button" onClick={() => onChange("dining_budget", b.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${data.dining_budget === b.id ? DC.cardSel : "border-gray-200 bg-white hover:border-gray-300"}`}>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">{b.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{b.sub}</p>
            </div>
            {data.dining_budget === b.id && <span className="text-diner-600 font-bold">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDinerMusic({ data, onChange }) {
  const genres = pj(data.music_genres, []);
  const toggle = (g) => onChange("music_genres", JSON.stringify(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]));
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">What music sets the mood for you when dining out?</p>
      <ChipSelect items={MUSIC_GENRES} selected={genres} onToggle={toggle}
        activeClass={DC.chip} hoverClass={DC.chipHover} />
    </div>
  );
}

function StepDiningHabits({ data, onChange }) {
  const group  = pj(data.dining_group, []);
  const toggleGroup = (v) => onChange("dining_group", JSON.stringify(group.includes(v) ? group.filter((x) => x !== v) : [...group, v]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">How often do you dine out?</p>
        <div className="flex flex-wrap gap-2">
          {DINING_FREQS.map((f) => (
            <button key={f.id} type="button" onClick={() => onChange("dining_frequency", f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${data.dining_frequency === f.id ? DC.chip : `bg-white text-gray-600 border-gray-200 ${DC.chipHover}`}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Who do you usually dine with? <span className="font-normal text-gray-400">(pick all)</span></p>
        <div className="grid grid-cols-2 gap-2">
          {DINING_GROUPS.map((g) => (
            <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
              className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${group.includes(g.id) ? DC.chip : `bg-white text-gray-600 border-gray-200 ${DC.chipHover}`}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepDinerSummary({ data }) {
  const occasions  = pj(data.dining_occasions, []).slice(0, 3);
  const atmosphere = pj(data.atmosphere_prefs, []).slice(0, 3);
  const cuisines   = pj(data.cuisine_preferences, []).slice(0, 4);
  const budget     = DINING_BUDGETS.find((b) => b.id === data.dining_budget);
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-diner-100 text-4xl mx-auto">🍽️</div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-diner-500 mb-1">Your Dining Identity</p>
        <h2 className="text-2xl font-extrabold text-gray-900">Food Explorer</h2>
        <p className="text-gray-500 text-sm mt-1">Curious, discerning, always searching for the perfect table.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        {budget && (
          <div className="bg-diner-50 border border-diner-100 rounded-xl p-3">
            <p className="text-xs text-diner-500 font-semibold uppercase tracking-wide">Budget</p>
            <p className="font-bold text-gray-800 mt-0.5">{budget.label}</p>
          </div>
        )}
        {data.dining_frequency && (
          <div className="bg-diner-50 border border-diner-100 rounded-xl p-3">
            <p className="text-xs text-diner-500 font-semibold uppercase tracking-wide">Frequency</p>
            <p className="font-bold text-gray-800 mt-0.5 capitalize">{DINING_FREQS.find((f) => f.id === data.dining_frequency)?.label || data.dining_frequency}</p>
          </div>
        )}
        {cuisines.length > 0 && (
          <div className="bg-diner-50 border border-diner-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-diner-500 font-semibold uppercase tracking-wide mb-1">Favourite Cuisines</p>
            <p className="text-sm text-gray-700">{cuisines.join(" · ")}</p>
          </div>
        )}
        {occasions.length > 0 && (
          <div className="bg-diner-50 border border-diner-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-diner-500 font-semibold uppercase tracking-wide mb-1">Dining For</p>
            <div className="flex flex-wrap gap-1">
              {occasions.map((o) => {
                const found = DINING_OCCASIONS.find((x) => x.id === o);
                return <span key={o} className="text-xs bg-white border border-diner-200 text-diner-700 px-2 py-0.5 rounded-full">{found?.label || o}</span>;
              })}
            </div>
          </div>
        )}
        {atmosphere.length > 0 && (
          <div className="bg-diner-50 border border-diner-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-diner-500 font-semibold uppercase tracking-wide mb-1">Atmosphere</p>
            <div className="flex flex-wrap gap-1">
              {atmosphere.map((a) => {
                const found = ATMOSPHERE_PREFS.find((x) => x.id === a);
                return <span key={a} className="text-xs bg-white border border-diner-200 text-diner-700 px-2 py-0.5 rounded-full">{found?.label || a}</span>;
              })}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-400">SavoryMind will now personalise your dining experience 🎉</p>
    </div>
  );
}

// ─── Flow configs ─────────────────────────────────────────────────────────────

const TYPE_STEP = { id: "type", title: "Pick your path", sub: "What brings you to SavoryMind?", icon: "🧭", fields: [] };

const CONSUMER_STEPS = [
  { id: "name",          title: "What's your name?",           sub: "Let's make this personal.",                   icon: "👋", fields: ["first_name","last_name"] },
  { id: "loc",           title: "Where are you based?",        sub: "We'll find food near you.",                   icon: "📍", fields: ["city","country","latitude","longitude"] },
  { id: "kitchen_style", title: "What kind of cook are you?",  sub: "Pick the style that feels most like you.",    icon: "👨‍🍳", fields: ["kitchen_style"] },
  { id: "cooking_habits",title: "How do you cook?",            sub: "Skill, frequency, time and budget.",          icon: "⏱️", fields: ["skill_level","cooking_frequency","cooking_time_pref","ingredient_budget"] },
  { id: "cuisines",      title: "Cuisines you love (& avoid)", sub: "Build your flavour map.",                     icon: "🌍", fields: ["cuisine_preferences","cuisine_dislikes"] },
  { id: "flavor",        title: "Your flavour profile",        sub: "Proteins, spice & taste preferences.",        icon: "🌶️", fields: ["flavor_profile"] },
  { id: "diet_goals",    title: "Diet & goals",                sub: "How you eat and what you're working towards.", icon: "🥗", fields: ["dietary_preferences","cooking_goals"] },
  { id: "drinks",        title: "What do you drink?",          sub: "We'll pair the right glass with your meals.", icon: "🍷", fields: ["drinking_habits","non_alcoholic_ok"] },
  { id: "music",         title: "Your kitchen soundtrack",     sub: "Music genres and cooking moods.",             icon: "🎵", fields: ["music_genres","music_moods"] },
  { id: "meal_types",    title: "What meals do you make?",     sub: "Tell us your favourite occasions.",           icon: "🍽️", fields: ["meal_types"] },
  { id: "kitchen_tools", title: "Your kitchen kit",            sub: "What equipment do you cook with?",           icon: "🔪", fields: ["kitchen_tools"] },
  { id: "summary",       title: "Your identity is ready!",     sub: "Here's your culinary persona.",              icon: "🎉", fields: [], isSummary: true },
];

const DINER_STEPS = [
  { id: "name",       title: "What's your name?",          sub: "Let's make this personal.",                    icon: "👋", fields: ["first_name","last_name"] },
  { id: "loc",        title: "Where are you based?",       sub: "We'll find the best restaurants near you.",    icon: "📍", fields: ["city","country","latitude","longitude"] },
  { id: "occasions",  title: "When do you dine out?",      sub: "Your dining occasions shape your experience.", icon: "🗓️", fields: ["dining_occasions"] },
  { id: "d_cuisines", title: "Cuisines you love",          sub: "What do you most love to eat out?",            icon: "🌍", fields: ["cuisine_preferences"] },
  { id: "taste_prefs",title: "Dietary preferences",        sub: "Any restrictions we should know about?",       icon: "🥗", fields: ["dietary_preferences"] },
  { id: "d_drinks",   title: "What do you drink?",         sub: "Helps us recommend the right spots.",          icon: "🍷", fields: ["drinking_habits"] },
  { id: "atmosphere", title: "Favourite atmosphere",       sub: "What kind of vibe do you look for?",           icon: "✨", fields: ["atmosphere_prefs"] },
  { id: "d_budget",   title: "Dining budget",              sub: "What's your typical spend per person?",        icon: "💰", fields: ["dining_budget"] },
  { id: "d_music",    title: "Dining soundtrack",          sub: "Music that sets the mood for you.",            icon: "🎵", fields: ["music_genres"] },
  { id: "habits",     title: "Your dining habits",         sub: "How often and who with?",                     icon: "🔁", fields: ["dining_frequency","dining_group"] },
  { id: "d_summary",  title: "Your identity is ready!",   sub: "Here's your Food Explorer profile.",           icon: "🎉", fields: [], isSummary: true },
];

const RESTAURANT_STEPS = [
  { id: "r_name",    title: "Tell us about yourself",      sub: "The owner behind the restaurant.",          icon: "👋", fields: ["first_name","last_name"] },
  { id: "r_rest",    title: "Your restaurant",             sub: "Name and type of venue.",                   icon: "🏪", fields: ["restaurant_name","business_type"] },
  { id: "r_style",   title: "Dining style & service",      sub: "How guests experience your venue.",         icon: "🍽️", fields: ["dining_style","service_type"] },
  { id: "loc",       title: "Where are you located?",      sub: "City and country.",                         icon: "📍", fields: ["city","country"] },
  { id: "r_cuisine", title: "Cuisine & audience",          sub: "What you serve and who you serve it to.",   icon: "🌍", fields: ["restaurant_cuisine","target_audience","seating_capacity"] },
  { id: "r_bev",     title: "Beverage program",            sub: "Drinks you offer your guests.",             icon: "🍷", fields: ["serves_wine","serves_cocktails","serves_beer","wine_program"] },
  { id: "r_goals",   title: "Your goals with SavoryMind",  sub: "What do you want to achieve?",             icon: "🎯", fields: ["restaurant_goals","peak_hours"] },
  { id: "r_summary", title: "Your restaurant is ready!",   sub: "Here's your SavoryMind profile.",          icon: "🎉", fields: [], isSummary: true },
];

// ─── Restaurant step components ───────────────────────────────────────────────

function StepRestName({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your First Name</label>
        <input value={data.first_name} onChange={(e) => onChange("first_name", e.target.value)}
          placeholder="First name" className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${RC.ring}`} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Last Name</label>
        <input value={data.last_name} onChange={(e) => onChange("last_name", e.target.value)}
          placeholder="Last name" className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${RC.ring}`} />
      </div>
    </div>
  );
}

function StepRestDetails({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Restaurant Name</label>
        <input value={data.restaurant_name} onChange={(e) => onChange("restaurant_name", e.target.value)}
          placeholder="e.g. La Bella Cucina" className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${RC.ring}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Type of venue</p>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_TYPES.map((b) => (
            <button key={b.id} type="button" onClick={() => onChange("business_type", b.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all text-sm ${data.business_type === b.id ? RC.cardSel : "border-gray-200 bg-white hover:border-gray-300"}`}>
              <span className="text-lg">{b.icon}</span>
              <span className="font-medium text-gray-800">{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepRestStyle({ data, onChange }) {
  const services = pj(data.service_type, []);
  const toggle   = (v) => onChange("service_type", JSON.stringify(services.includes(v) ? services.filter((x) => x !== v) : [...services, v]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Dining style</p>
        <div className="grid grid-cols-1 gap-2">
          {DINING_STYLES.map((s) => (
            <button key={s.id} type="button" onClick={() => onChange("dining_style", s.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${data.dining_style === s.id ? RC.cardSel : "border-gray-200 bg-white hover:border-gray-300"}`}>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                <p className="text-xs text-gray-400">{s.sub}</p>
              </div>
              {data.dining_style === s.id && <span className="text-brand-600 font-bold">✓</span>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Services offered <span className="font-normal text-gray-400">(pick all)</span></p>
        <ChipSelect items={SERVICE_TYPES} selected={services} onToggle={toggle} activeClass={RC.chip} hoverClass={RC.chipHover} />
      </div>
    </div>
  );
}

function StepRestCuisine({ data, onChange }) {
  const cuisines  = pj(data.restaurant_cuisine, []);
  const audience  = pj(data.target_audience, []);
  const toggleC   = (v) => onChange("restaurant_cuisine", JSON.stringify(cuisines.includes(v) ? cuisines.filter((x) => x !== v) : [...cuisines, v]));
  const toggleA   = (v) => onChange("target_audience",    JSON.stringify(audience.includes(v)  ? audience.filter((x) => x !== v)  : [...audience, v]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Cuisines you serve</p>
        <ChipSelect items={CUISINES} selected={cuisines} onToggle={toggleC} activeClass={RC.chip} hoverClass={RC.chipHover} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Target audience <span className="font-normal text-gray-400">(pick all)</span></p>
        <div className="grid grid-cols-2 gap-2">
          {REST_AUDIENCE.map((a) => (
            <button key={a.id} type="button" onClick={() => toggleA(a.id)}
              className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${audience.includes(a.id) ? RC.chip : `bg-white text-gray-600 border-gray-200 ${RC.chipHover}`}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Seating capacity <span className="font-normal text-gray-400">(optional)</span></label>
        <input type="number" min="1" value={data.seating_capacity || ""}
          onChange={(e) => onChange("seating_capacity", e.target.value ? parseInt(e.target.value) : "")}
          placeholder="e.g. 80" className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${RC.ring}`} />
      </div>
    </div>
  );
}

function StepRestBeverage({ data, onChange }) {
  const wineList = pj(data.wine_program, []);
  const toggleW  = (v) => onChange("wine_program", JSON.stringify(wineList.includes(v) ? wineList.filter((x) => x !== v) : [...wineList, v]));
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Tell us what you pour — we'll match guests to your bar.</p>
      <div className="space-y-3">
        {[
          { key: "serves_wine",      icon: "🍷", label: "Wine" },
          { key: "serves_cocktails", icon: "🍸", label: "Cocktails" },
          { key: "serves_beer",      icon: "🍺", label: "Beer" },
        ].map(({ key, icon, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50">
            <input type="checkbox" checked={!!data[key]} onChange={(e) => onChange(key, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300" />
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-medium text-gray-800">{label}</span>
          </label>
        ))}
      </div>
      {data.serves_wine && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Wine list highlights</p>
          <ChipSelect items={WINE_PROGRAM_OPTS} selected={wineList} onToggle={toggleW} activeClass={RC.chip} hoverClass={RC.chipHover} />
        </div>
      )}
    </div>
  );
}

function StepRestGoals({ data, onChange }) {
  const goals = pj(data.restaurant_goals, []);
  const hours = pj(data.peak_hours, []);
  const toggleG = (v) => onChange("restaurant_goals", JSON.stringify(goals.includes(v) ? goals.filter((x) => x !== v) : [...goals, v]));
  const toggleH = (v) => onChange("peak_hours",       JSON.stringify(hours.includes(v) ? hours.filter((x) => x !== v) : [...hours, v]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">What do you want from SavoryMind? <span className="font-normal text-gray-400">(pick all)</span></p>
        <div className="grid grid-cols-2 gap-2">
          {REST_GOALS.map((g) => (
            <button key={g.id} type="button" onClick={() => toggleG(g.id)}
              className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${goals.includes(g.id) ? RC.chip : `bg-white text-gray-600 border-gray-200 ${RC.chipHover}`}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Peak service hours <span className="font-normal text-gray-400">(pick all)</span></p>
        <div className="grid grid-cols-2 gap-2">
          {PEAK_HOURS.map((h) => (
            <button key={h.id} type="button" onClick={() => toggleH(h.id)}
              className={`px-4 py-3 rounded-xl text-sm font-medium border text-left transition-colors ${hours.includes(h.id) ? RC.chip : `bg-white text-gray-600 border-gray-200 ${RC.chipHover}`}`}>
              {h.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepRestSummary({ data }) {
  const btype    = BUSINESS_TYPES.find((b) => b.id === data.business_type);
  const cuisines = pj(data.restaurant_cuisine, []).slice(0, 4);
  const goals    = pj(data.restaurant_goals, []).slice(0, 3);
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 text-4xl mx-auto">
        {btype?.icon || "🏪"}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">Your Restaurant Profile</p>
        <h2 className="text-2xl font-extrabold text-gray-900">{data.restaurant_name || "Your Restaurant"}</h2>
        <p className="text-gray-500 text-sm mt-1">{btype?.label || "Restaurant"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        {data.city && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wide">Location</p>
            <p className="font-bold text-gray-800 mt-0.5">{data.city}{data.country ? `, ${data.country}` : ""}</p>
          </div>
        )}
        {data.seating_capacity && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wide">Capacity</p>
            <p className="font-bold text-gray-800 mt-0.5">{data.seating_capacity} seats</p>
          </div>
        )}
        {cuisines.length > 0 && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wide mb-1">Cuisines</p>
            <p className="text-sm text-gray-700">{cuisines.join(" · ")}</p>
          </div>
        )}
        {goals.length > 0 && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 col-span-2">
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wide mb-1">Goals</p>
            <div className="flex flex-wrap gap-1">
              {goals.map((g) => {
                const found = REST_GOALS.find((x) => x.id === g);
                return <span key={g} className="text-xs bg-white border border-brand-200 text-brand-700 px-2 py-0.5 rounded-full">{found?.label || g}</span>;
              })}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-400">SavoryMind will now power your restaurant intelligence 🎉</p>
    </div>
  );
}

// ─── Main Onboarding component ────────────────────────────────────────────────

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [step,   setStep]   = useState(0);

  const needsTypeStep = !user?.account_type;
  const [showType, setShowType] = useState(needsTypeStep);

  const [data, setData] = useState({
    account_type:        user?.account_type || null,
    first_name:          user?.first_name   || "",
    last_name:           user?.last_name    || "",
    city: "", country: "", latitude: null, longitude: null,
    kitchen_style: "", skill_level: "", cooking_frequency: "",
    cooking_time_pref: "", ingredient_budget: "",
    cuisine_preferences: "", cuisine_dislikes: "",
    flavor_profile: "", dietary_preferences: "", cooking_goals: "",
    drinking_habits: "", non_alcoholic_ok: false,
    music_genres: "", music_moods: "",
    meal_types: "", kitchen_tools: "",
    restaurant_name: user?.restaurant_name || "",
  });

  const onChange = (key, val) => setData((d) => ({ ...d, [key]: val }));

  const acType = data.account_type;
  const steps  = acType === "consumer"   ? CONSUMER_STEPS
               : acType === "diner"      ? DINER_STEPS
               : acType === "restaurant" ? RESTAURANT_STEPS
               : RESTAURANT_STEPS;
  const current   = steps[step];
  const isLast    = step === steps.length - 1;
  const progress  = ((step + 1) / steps.length) * 100;
  const firstName = data.first_name || user?.first_name || "";
  const colours   = acType === "diner" ? DC : acType === "restaurant" ? RC : CC;

  // Save current step's fields then advance
  const handleNext = async () => {
    if (isLast || current.isSummary) {
      setSaving(true); setError(null);
      try {
        const updated = await api.updateProfile({ onboarding_completed: true });
        updateUser(updated);
        // Sync localStorage before navigation so _app.js route guard sees onboarding_completed immediately
        try { localStorage.setItem("user", JSON.stringify(updated)); } catch {}
        const dest = updated.account_type === "consumer" ? "/consumer/dashboard"
                   : updated.account_type === "diner"    ? "/diner/welcome"
                   : "/dashboard";
        router.push(dest);
      } catch (e) { setError(e.message || "Something went wrong."); }
      finally { setSaving(false); }
      return;
    }

    // Save this step's fields
    const payload = {};
    current.fields.forEach((f) => {
      const v = data[f];
      if (v !== null && v !== undefined && v !== "") payload[f] = v;
    });
    if (Object.keys(payload).length > 0) {
      setSaving(true); setError(null);
      try {
        const updated = await api.updateProfile(payload);
        updateUser(updated);
      } catch (e) { setError(e.message || "Error saving — you can continue."); }
      finally { setSaving(false); }
    }
    setStep((s) => s + 1);
  };

  const handleTypeNext = async () => {
    if (!data.account_type) { setError("Please pick your experience type."); return; }
    setSaving(true); setError(null);
    try {
      const updated = await api.updateProfile({ account_type: data.account_type });
      updateUser(updated);
      setShowType(false);
      setStep(0);
    } catch (e) { setError(e.message || "Something went wrong."); }
    finally { setSaving(false); }
  };

  // ── Type selection screen ──
  if (showType) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-2 sticky top-0 z-10">
          <span className="text-xl">🧠</span>
          <span className="font-bold text-gray-900">SavoryMind</span>
        </header>
        <div className="flex-1 flex flex-col items-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🧭</div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Pick your path</h1>
              <p className="text-gray-500">What brings you to SavoryMind?</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
              <StepAccountType data={data} onChange={onChange} />
            </div>
            {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
            <button type="button" onClick={handleTypeNext} disabled={saving || !data.account_type}
              className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 disabled:opacity-60 transition-colors">
              {saving ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Flow step screen ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2"><span className="text-xl">🧠</span><span className="font-bold text-gray-900">SavoryMind</span></div>
        <div className="text-sm text-gray-400">{step + 1} of {steps.length}</div>
      </header>
      <div className="h-1 bg-gray-100 sticky top-[65px] z-10">
        <div className={`h-full ${colours.progress} transition-all duration-500`} style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{current.icon}</div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">{current.title}</h1>
            <p className="text-gray-500">{current.sub}</p>
            {firstName && step > 0 && <p className="text-sm text-gray-400 mt-1">Hey {firstName} 👋</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            {/* shared */}
            {current.id === "name"          && <StepName           data={data} onChange={onChange} />}
            {current.id === "loc"           && <StepLocation        data={data} onChange={onChange} />}
            {/* consumer */}
            {current.id === "kitchen_style" && <StepKitchenStyle    data={data} onChange={onChange} />}
            {current.id === "cooking_habits"&& <StepCookingHabits   data={data} onChange={onChange} />}
            {current.id === "cuisines"      && <StepCuisines        data={data} onChange={onChange} />}
            {current.id === "flavor"        && <StepFlavor          data={data} onChange={onChange} />}
            {current.id === "diet_goals"    && <StepDietGoals       data={data} onChange={onChange} />}
            {current.id === "drinks"        && <StepDrinks          data={data} onChange={onChange} />}
            {current.id === "music"         && <StepMusic           data={data} onChange={onChange} />}
            {current.id === "meal_types"    && <StepMealTypes       data={data} onChange={onChange} />}
            {current.id === "kitchen_tools" && <StepKitchenTools    data={data} onChange={onChange} />}
            {current.id === "summary"       && <StepConsumerSummary data={data} />}
            {/* diner */}
            {current.id === "occasions"     && <StepDiningOccasions data={data} onChange={onChange} />}
            {current.id === "d_cuisines"    && <StepDinerCuisines   data={data} onChange={onChange} />}
            {current.id === "taste_prefs"   && <StepTastePrefs      data={data} onChange={onChange} />}
            {current.id === "d_drinks"      && <StepDrinks          data={data} onChange={onChange} />}
            {current.id === "atmosphere"    && <StepAtmosphere      data={data} onChange={onChange} />}
            {current.id === "d_budget"      && <StepDiningBudget    data={data} onChange={onChange} />}
            {current.id === "d_music"       && <StepDinerMusic      data={data} onChange={onChange} />}
            {current.id === "habits"        && <StepDiningHabits    data={data} onChange={onChange} />}
            {current.id === "d_summary"     && <StepDinerSummary    data={data} />}
            {/* restaurant */}
            {current.id === "r_name"        && <StepRestName        data={data} onChange={onChange} />}
            {current.id === "r_rest"        && <StepRestDetails     data={data} onChange={onChange} />}
            {current.id === "r_style"       && <StepRestStyle       data={data} onChange={onChange} />}
            {current.id === "r_cuisine"     && <StepRestCuisine     data={data} onChange={onChange} />}
            {current.id === "r_bev"         && <StepRestBeverage    data={data} onChange={onChange} />}
            {current.id === "r_goals"       && <StepRestGoals       data={data} onChange={onChange} />}
            {current.id === "r_summary"     && <StepRestSummary     data={data} />}
          </div>

          {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)}
                className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
            )}
            {!current.isSummary && (
              <button type="button" onClick={() => setStep((s) => s + 1)}
                className="px-5 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Skip
              </button>
            )}
            <button type="button" onClick={handleNext} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 disabled:opacity-60 transition-colors">
              {saving ? "Saving…" : isLast ? "Enter SavoryMind →" : "Continue →"}
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {steps.map((s, i) => (
              <div key={s.id} className={`h-1.5 rounded-full transition-all ${i === step ? `w-6 ${colours.dot}` : i < step ? "w-3 bg-gray-400" : "w-3 bg-gray-200"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
