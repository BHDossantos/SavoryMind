import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

// ─── Option sets ────────────────────────────────────────────────────────────
const CUISINES = [
  "Italian","Japanese","Mexican","French","Indian","American",
  "Mediterranean","Thai","Chinese","Greek","Spanish","Middle Eastern",
  "Korean","Vietnamese","Brazilian","Moroccan","Turkish","Ethiopian",
  "Caribbean","Peruvian",
];

const DIETARY = [
  { id: "meat_lover",    label: "🥩 Meat Lover" },
  { id: "pescatarian",   label: "🐟 Pescatarian" },
  { id: "vegetarian",    label: "🥦 Vegetarian" },
  { id: "vegan",         label: "🌱 Vegan" },
  { id: "gluten_free",   label: "🌾 Gluten-Free" },
  { id: "dairy_free",    label: "🥛 Dairy-Free" },
  { id: "halal",         label: "☪️ Halal" },
  { id: "kosher",        label: "✡️ Kosher" },
  { id: "keto",          label: "🥑 Keto" },
  { id: "low_carb",      label: "📉 Low-Carb" },
  { id: "nut_free",      label: "🥜 Nut-Free" },
  { id: "no_restriction",label: "✅ No restrictions" },
];

const DRINK_TYPES = [
  { id: "wine",      label: "🍷 Wine",     sub: "Red, white, rosé, sparkling" },
  { id: "beer",      label: "🍺 Beer",     sub: "Craft, lager, IPA, stout" },
  { id: "spirits",   label: "🥃 Spirits",  sub: "Whiskey, rum, gin, tequila" },
  { id: "cocktails", label: "🍸 Cocktails", sub: "Classic, modern, mocktails" },
];

const FREQUENCIES = ["Never","Occasionally","Regularly","Often"];

const MUSIC_GENRES = [
  "Jazz","Classical","Pop","R&B / Soul","Rock","Hip-Hop",
  "Country","Electronic","Latin","Folk","Blues","World Music",
  "Reggae","Indie","Funk","Gospel",
];

const RECIPE_INTERESTS = [
  { id: "quick",       label: "⚡ Quick meals",         sub: "Under 30 minutes" },
  { id: "meal_prep",   label: "📦 Meal prep",           sub: "Batch cooking for the week" },
  { id: "fine_dining", label: "✨ Fine dining inspired", sub: "Restaurant-quality at home" },
  { id: "budget",      label: "💰 Budget-friendly",     sub: "Great food, low cost" },
  { id: "global",      label: "🌍 Global cuisines",     sub: "Explore the world through food" },
  { id: "healthy",     label: "🥗 Healthy & light",     sub: "Nutritious, balanced meals" },
  { id: "comfort",     label: "🫶 Comfort food",        sub: "Soul-warming classics" },
  { id: "desserts",    label: "🎂 Desserts & baking",   sub: "Cakes, cookies, pastries" },
  { id: "bbq",         label: "🔥 BBQ & grilling",     sub: "Outdoor cooking, smoke & char" },
  { id: "plant_based", label: "🌿 Plant-based",         sub: "Creative vegetarian & vegan" },
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium",
  "Bolivia","Brazil","Canada","Chile","China","Colombia","Croatia","Czech Republic",
  "Denmark","Ecuador","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece",
  "Guatemala","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kenya","Lebanon","Malaysia","Mexico","Morocco","Netherlands",
  "New Zealand","Nigeria","Norway","Pakistan","Panama","Peru","Philippines","Poland",
  "Portugal","Romania","Russia","Saudi Arabia","Senegal","Singapore","South Africa",
  "South Korea","Spain","Sri Lanka","Sweden","Switzerland","Thailand","Tunisia","Turkey",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay",
  "Venezuela","Vietnam","Other",
];

// ─── Step components ─────────────────────────────────────────────────────────

function StepName({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name</label>
        <input
          value={data.first_name}
          onChange={(e) => onChange("first_name", e.target.value)}
          placeholder="Your first name"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
        <input
          value={data.last_name}
          onChange={(e) => onChange("last_name", e.target.value)}
          placeholder="Your last name"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
    </div>
  );
}

function StepLocation({ data, onChange }) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const detectLocation = () => {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported by your browser."); return; }
    setGeoLoading(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange("latitude", pos.coords.latitude);
        onChange("longitude", pos.coords.longitude);
        setGeoLoading(false);
      },
      () => { setGeoError("Couldn't get location. Please enter it manually."); setGeoLoading(false); }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">City</label>
        <input
          value={data.city}
          onChange={(e) => onChange("city", e.target.value)}
          placeholder="e.g. Rome, New York, Tokyo..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <p className="text-xs text-gray-400 mt-1">We use this to recommend nearby restaurants and local food trends.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Country</label>
        <select
          value={data.country}
          onChange={(e) => onChange("country", e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          <option value="">Select your country...</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-2">📍 Precise location (optional)</p>
        <p className="text-xs text-gray-500 mb-3">Allow location access for hyper-local restaurant recommendations near you.</p>
        {data.latitude ? (
          <p className="text-xs text-green-600 font-medium">✓ Location captured ({data.latitude.toFixed(4)}, {data.longitude.toFixed(4)})</p>
        ) : (
          <>
            <button
              type="button"
              onClick={detectLocation}
              disabled={geoLoading}
              className="text-sm bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              {geoLoading ? "Detecting..." : "Use My Location"}
            </button>
            {geoError && <p className="text-xs text-red-500 mt-2">{geoError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function StepFood({ data, onChange }) {
  const toggleCuisine = (c) => {
    const curr = data.cuisine_preferences ? JSON.parse(data.cuisine_preferences) : [];
    const next = curr.includes(c) ? curr.filter((x) => x !== c) : [...curr, c];
    onChange("cuisine_preferences", JSON.stringify(next));
  };

  const toggleDiet = (d) => {
    const curr = data.dietary_preferences ? JSON.parse(data.dietary_preferences) : [];
    const next = curr.includes(d) ? curr.filter((x) => x !== d) : [...curr, d];
    onChange("dietary_preferences", JSON.stringify(next));
  };

  const selected_cuisines = data.cuisine_preferences ? JSON.parse(data.cuisine_preferences) : [];
  const selected_diet     = data.dietary_preferences ? JSON.parse(data.dietary_preferences) : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Which cuisines do you love? <span className="text-gray-400 font-normal">(pick all that apply)</span></p>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <button
              key={c} type="button"
              onClick={() => toggleCuisine(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                selected_cuisines.includes(c)
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Dietary preferences</p>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY.map((d) => (
            <button
              key={d.id} type="button"
              onClick={() => toggleDiet(d.id)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border text-left transition-colors ${
                selected_diet.includes(d.id)
                  ? "bg-brand-50 text-brand-700 border-brand-400"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepDrinking({ data, onChange }) {
  const habits = data.drinking_habits ? JSON.parse(data.drinking_habits) : {};

  const setFreq = (type, freq) => {
    const next = { ...habits, [type]: freq };
    onChange("drinking_habits", JSON.stringify(next));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">This helps us pair the right drinks with your food and set the perfect mood.</p>
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
            {FREQUENCIES.map((f) => (
              <button
                key={f} type="button"
                onClick={() => setFreq(dt.id, f.toLowerCase())}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  habits[dt.id] === f.toLowerCase()
                    ? "bg-consumer-600 text-white border-consumer-600"
                    : "bg-white text-gray-500 border-gray-200 hover:border-consumer-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepMusic({ data, onChange }) {
  const toggle = (g) => {
    const curr = data.music_genres ? JSON.parse(data.music_genres) : [];
    const next = curr.includes(g) ? curr.filter((x) => x !== g) : [...curr, g];
    onChange("music_genres", JSON.stringify(next));
  };
  const selected = data.music_genres ? JSON.parse(data.music_genres) : [];

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">We use this to suggest the perfect dining soundtrack — whether you're cooking at home or picking a restaurant vibe.</p>
      <div className="flex flex-wrap gap-2">
        {MUSIC_GENRES.map((g) => (
          <button
            key={g} type="button"
            onClick={() => toggle(g)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              selected.includes(g)
                ? "bg-consumer-600 text-white border-consumer-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-consumer-300"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepRecipes({ data, onChange }) {
  const toggle = (r) => {
    const curr = data.recipe_interests ? JSON.parse(data.recipe_interests) : [];
    const next = curr.includes(r) ? curr.filter((x) => x !== r) : [...curr, r];
    onChange("recipe_interests", JSON.stringify(next));
  };
  const selected = data.recipe_interests ? JSON.parse(data.recipe_interests) : [];

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Pick everything that excites you — we'll use this to surface the most relevant recipes and recommendations.</p>
      <div className="grid grid-cols-1 gap-2">
        {RECIPE_INTERESTS.map((r) => (
          <button
            key={r.id} type="button"
            onClick={() => toggle(r.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
              selected.includes(r.id)
                ? "bg-diner-50 border-diner-400 text-diner-800"
                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="text-xl">{r.label.split(" ")[0]}</span>
            <div>
              <p className="text-sm font-semibold">{r.label.split(" ").slice(1).join(" ")}</p>
              <p className="text-xs text-gray-400">{r.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main onboarding page ────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: "What's your name?",          sub: "Let's make this personal.",                     icon: "👋" },
  { id: 2, title: "Where are you based?",        sub: "We'll find food and restaurants near you.",     icon: "📍" },
  { id: 3, title: "What do you love to eat?",    sub: "Your palate, your rules.",                      icon: "🍽️" },
  { id: 4, title: "What do you like to drink?",  sub: "Tell us about your drink habits.",              icon: "🍷" },
  { id: 5, title: "What's your music taste?",    sub: "Every great meal has a soundtrack.",            icon: "🎵" },
  { id: 6, title: "Recipe interests",            sub: "What kind of cooking gets you excited?",        icon: "👨‍🍳" },
];

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [data, setData] = useState({
    first_name:          "",
    last_name:           "",
    city:                "",
    country:             "",
    latitude:            null,
    longitude:           null,
    cuisine_preferences: "",
    dietary_preferences: "",
    drinking_habits:     "",
    music_genres:        "",
    recipe_interests:    "",
  });

  const onChange = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const isLastStep = step === STEPS.length;
  const current = STEPS[step - 1];
  const progress = (step / STEPS.length) * 100;

  const handleNext = async () => {
    if (!isLastStep) { setStep((s) => s + 1); return; }

    setSaving(true); setError(null);
    try {
      const payload = {
        ...data,
        latitude:  data.latitude  || undefined,
        longitude: data.longitude || undefined,
        onboarding_completed: true,
      };
      // Strip empty strings to avoid overwriting with blanks
      Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });

      const updated = await api.updateProfile(payload);
      updateUser(updated);

      const dest = updated.account_type === "consumer"
        ? "/consumer/dashboard"
        : updated.account_type === "diner"
          ? "/diner/dashboard"
          : "/dashboard";
      router.push(dest);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (isLastStep) handleNext();
    else setStep((s) => s + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <span className="font-bold text-gray-900">SavoryMind</span>
        </div>
        <div className="text-sm text-gray-400">
          {step} of {STEPS.length}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 sticky top-[65px] z-10">
        <div
          className="h-full bg-gradient-to-r from-brand-500 via-diner-500 to-consumer-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Step header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{current.icon}</div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">{current.title}</h1>
            <p className="text-gray-500">{current.sub}</p>
            {user?.first_name && step > 1 && (
              <p className="text-sm text-gray-400 mt-1">Hey {user.first_name || data.first_name} 👋</p>
            )}
          </div>

          {/* Step content */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            {step === 1 && <StepName       data={data} onChange={onChange} />}
            {step === 2 && <StepLocation   data={data} onChange={onChange} />}
            {step === 3 && <StepFood       data={data} onChange={onChange} />}
            {step === 4 && <StepDrinking   data={data} onChange={onChange} />}
            {step === 5 && <StepMusic      data={data} onChange={onChange} />}
            {step === 6 && <StepRecipes    data={data} onChange={onChange} />}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={handleSkip}
              className="px-5 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving..." : isLastStep ? "Finish & Enter SavoryMind →" : "Continue →"}
            </button>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-2 mt-6">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  s.id === step ? "w-6 bg-gray-900" : s.id < step ? "w-3 bg-gray-400" : "w-3 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
