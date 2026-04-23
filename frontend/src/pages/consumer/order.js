import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// Dish archetypes: emotion → dish first, not restaurant first
const CRAVINGS = [
  { id: "rich_warm",   emoji: "🍲", label: "Rich & Warm",    desc: "Stews, braised mains, hearty bowls",   mood: "cozy" },
  { id: "light_fresh", emoji: "🥗", label: "Light & Fresh",  desc: "Salads, grain bowls, sushi, poke",     mood: "healthy" },
  { id: "spicy_bold",  emoji: "🌶️", label: "Spicy & Bold",   desc: "Curries, tacos, Korean, Thai",         mood: "adventurous" },
  { id: "comfort",     emoji: "🍕", label: "Comfort Food",   desc: "Pizza, burgers, pasta, fried chicken", mood: "indulgent" },
  { id: "fast_easy",   emoji: "⚡", label: "Fast & Easy",    desc: "Ready in 20 min or less",              mood: "quick" },
  { id: "sweet_treat", emoji: "🍰", label: "Something Sweet", desc: "Desserts, pastries, waffles",         mood: "brunch" },
];

const BUDGETS = [
  { id: "budget",   label: "Budget", sub: "Under $15" },
  { id: "midrange", label: "Mid",    sub: "$15–$30"   },
  { id: "treat",    label: "Treat",  sub: "$30+"       },
];

// Simulated dish catalog — in production this would come from an API
const DISH_CATALOG = {
  rich_warm:   [
    { id: 1, name: "Beef Bourguignon",     emoji: "🥩", cuisine: "French",    time: "45 min", price: "$22", rating: 4.8, tags: ["hearty", "slow-cooked"] },
    { id: 2, name: "Tom Kha Gai",          emoji: "🍜", cuisine: "Thai",      time: "35 min", price: "$16", rating: 4.7, tags: ["creamy", "comforting"] },
    { id: 3, name: "Butter Chicken",       emoji: "🍛", cuisine: "Indian",    time: "40 min", price: "$18", rating: 4.9, tags: ["creamy", "aromatic"] },
    { id: 4, name: "French Onion Soup",    emoji: "🧅", cuisine: "French",    time: "30 min", price: "$14", rating: 4.6, tags: ["classic", "cheesy"] },
  ],
  light_fresh: [
    { id: 5,  name: "Salmon Poke Bowl",    emoji: "🐟", cuisine: "Hawaiian",   time: "15 min", price: "$18", rating: 4.8, tags: ["fresh", "omega-3"] },
    { id: 6,  name: "Quinoa Buddha Bowl",  emoji: "🥗", cuisine: "Modern",     time: "20 min", price: "$14", rating: 4.5, tags: ["vegan", "nutrient-dense"] },
    { id: 7,  name: "Sushi Platter",       emoji: "🍣", cuisine: "Japanese",   time: "10 min", price: "$24", rating: 4.9, tags: ["fresh", "premium"] },
    { id: 8,  name: "Vietnamese Rolls",    emoji: "🥢", cuisine: "Vietnamese", time: "15 min", price: "$12", rating: 4.6, tags: ["light", "zingy"] },
  ],
  spicy_bold:  [
    { id: 9,  name: "Green Curry",         emoji: "🍛", cuisine: "Thai",       time: "30 min", price: "$17", rating: 4.7, tags: ["spicy", "aromatic"] },
    { id: 10, name: "Birria Tacos",        emoji: "🌮", cuisine: "Mexican",    time: "25 min", price: "$16", rating: 4.9, tags: ["bold", "cheesy"] },
    { id: 11, name: "Dak Galbi",           emoji: "🐔", cuisine: "Korean",     time: "30 min", price: "$19", rating: 4.8, tags: ["spicy", "smoky"] },
    { id: 12, name: "Rendang",             emoji: "🥩", cuisine: "Indonesian", time: "45 min", price: "$20", rating: 4.7, tags: ["intense", "slow-cooked"] },
  ],
  comfort:     [
    { id: 13, name: "Margherita Pizza",    emoji: "🍕", cuisine: "Italian",    time: "25 min", price: "$15", rating: 4.7, tags: ["classic", "cheesy"] },
    { id: 14, name: "Smash Burger",        emoji: "🍔", cuisine: "American",   time: "20 min", price: "$16", rating: 4.8, tags: ["juicy", "satisfying"] },
    { id: 15, name: "Mac & Cheese",        emoji: "🧀", cuisine: "American",   time: "20 min", price: "$12", rating: 4.6, tags: ["creamy", "comfort"] },
    { id: 16, name: "Lasagne",             emoji: "🫕", cuisine: "Italian",    time: "50 min", price: "$18", rating: 4.7, tags: ["hearty", "baked"] },
  ],
  fast_easy:   [
    { id: 17, name: "Caesar Wrap",         emoji: "🌯", cuisine: "Modern",     time: "10 min", price: "$11", rating: 4.5, tags: ["quick", "filling"] },
    { id: 18, name: "Pad Thai",            emoji: "🍜", cuisine: "Thai",       time: "20 min", price: "$15", rating: 4.7, tags: ["quick", "street-food"] },
    { id: 19, name: "Falafel Bowl",        emoji: "🧆", cuisine: "Middle East",time: "15 min", price: "$13", rating: 4.6, tags: ["vegan", "quick"] },
    { id: 20, name: "Eggs Benedict",       emoji: "🍳", cuisine: "Brunch",     time: "15 min", price: "$14", rating: 4.5, tags: ["brunch", "quick"] },
  ],
  sweet_treat: [
    { id: 21, name: "Crème Brûlée",        emoji: "🍮", cuisine: "French",     time: "5 min",  price: "$9",  rating: 4.8, tags: ["classic", "indulgent"] },
    { id: 22, name: "Tiramisu",            emoji: "☕", cuisine: "Italian",    time: "5 min",  price: "$10", rating: 4.9, tags: ["creamy", "coffee"] },
    { id: 23, name: "Mochi Ice Cream",     emoji: "🍡", cuisine: "Japanese",   time: "5 min",  price: "$8",  rating: 4.7, tags: ["unique", "light"] },
    { id: 24, name: "Chocolate Lava Cake", emoji: "🍫", cuisine: "Modern",     time: "15 min", price: "$11", rating: 4.9, tags: ["indulgent", "warm"] },
  ],
};

// Simulated restaurant matches per dish
function getRestaurantsForDish(dishId) {
  return [
    { id: `r${dishId}a`, name: "La Cucina",     emoji: "🏡", rating: 4.8, time: "25–35 min", dist: "1.2 km", fee: "Free delivery" },
    { id: `r${dishId}b`, name: "The Fork & Co", emoji: "🍴", rating: 4.6, time: "30–45 min", dist: "2.0 km", fee: "$1.99 delivery" },
    { id: `r${dishId}c`, name: "Nouri Kitchen", emoji: "🌿", rating: 4.7, time: "20–30 min", dist: "0.8 km", fee: "Free delivery" },
  ];
}

// Step indicator
function Steps({ current }) {
  const steps = ["Craving", "Dish", "Restaurant", "Order"];
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
  const { user } = useAuth();
  const [step, setStep] = useState(0);           // 0=craving, 1=dish, 2=restaurant, 3=order
  const [craving, setCraving] = useState(null);
  const [dish, setDish] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [budget, setBudget] = useState("midrange");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [ordered, setOrdered] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "there";
  const cuisinePrefs = pj(user?.cuisine_preferences, []);

  const selectCraving = (c) => { setCraving(c); setDish(null); setRestaurant(null); setStep(1); };
  const selectDish    = (d) => { setDish(d); setRestaurant(null); setStep(2); };
  const selectRestaurant = (r) => { setRestaurant(r); setStep(3); };

  const placeOrder = async () => {
    if (!address.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setOrdered(true);
    setSubmitting(false);
  };

  if (ordered) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <div className="text-6xl mb-4">🛵</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order placed!</h2>
        <p className="text-gray-500 mb-2">
          Your <strong>{dish?.name}</strong> from <strong>{restaurant?.name}</strong> is on its way.
        </p>
        <p className="text-sm text-gray-400 mb-8">Estimated delivery: {restaurant?.time}</p>
        <button onClick={() => { setOrdered(false); setStep(0); setCraving(null); setDish(null); setRestaurant(null); setAddress(""); setNote(""); }}
          className="bg-consumer-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-consumer-700 transition-colors">
          Order something else
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🛵 Order</h1>
        <p className="text-gray-400 mt-1">What are you feeling, {firstName}?</p>
      </div>

      <Steps current={step} />

      {/* Step 0 — Pick a craving */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">What are you hungry for tonight?</h2>
          <p className="text-sm text-gray-400 mb-6">
            We'll find dishes — then show you who delivers them best.
          </p>

          {/* Budget toggle */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-gray-500 mr-1">Budget:</span>
            {BUDGETS.map((b) => (
              <button key={b.id} onClick={() => setBudget(b.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                  budget === b.id
                    ? "bg-consumer-600 text-white border-consumer-600"
                    : "bg-white text-gray-600 border-consumer-200 hover:border-consumer-400"}`}>
                {b.label} <span className="text-xs opacity-70">{b.sub}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CRAVINGS.map((c) => (
              <button key={c.id} onClick={() => selectCraving(c)}
                className="text-left bg-white border border-consumer-100 rounded-2xl p-5 hover:border-consumer-500 hover:shadow-md transition-all group">
                <span className="text-3xl block mb-2">{c.emoji}</span>
                <p className="font-bold text-gray-900 text-sm group-hover:text-consumer-700">{c.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — Pick a dish */}
      {step === 1 && craving && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(0)}
              className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">
              ← Back
            </button>
            <div className="flex items-center gap-2 bg-consumer-50 rounded-full px-4 py-1.5">
              <span>{craving.emoji}</span>
              <span className="text-sm font-semibold text-consumer-700">{craving.label}</span>
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">Choose a dish</h2>
          <p className="text-sm text-gray-400 mb-6">
            These match your craving — we'll find restaurants after.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(DISH_CATALOG[craving.id] || []).map((d) => (
              <button key={d.id} onClick={() => selectDish(d)}
                className="text-left bg-white border border-consumer-100 rounded-2xl p-5 hover:border-consumer-500 hover:shadow-md transition-all group flex items-center gap-4">
                <span className="text-4xl flex-shrink-0">{d.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-gray-900 group-hover:text-consumer-700">{d.name}</p>
                    <span className="text-sm font-bold text-consumer-600 ml-2">{d.price}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{d.cuisine} · {d.time}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-amber-500 font-semibold">★ {d.rating}</span>
                    {d.tags.map((t) => (
                      <span key={t} className="text-xs bg-consumer-50 text-consumer-600 px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Pick a restaurant */}
      {step === 2 && dish && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(1)}
              className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">
              ← Back
            </button>
            <div className="flex items-center gap-2 bg-consumer-50 rounded-full px-4 py-1.5">
              <span>{dish.emoji}</span>
              <span className="text-sm font-semibold text-consumer-700">{dish.name}</span>
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">Who delivers this best near you?</h2>
          <p className="text-sm text-gray-400 mb-6">
            Restaurants ranked by rating and delivery speed.
          </p>

          <div className="space-y-3">
            {getRestaurantsForDish(dish.id).map((r, i) => (
              <button key={r.id} onClick={() => selectRestaurant(r)}
                className="w-full text-left bg-white border border-consumer-100 rounded-2xl p-5 hover:border-consumer-500 hover:shadow-md transition-all group flex items-center gap-4">
                <span className="text-3xl flex-shrink-0">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900 group-hover:text-consumer-700">{r.name}</p>
                    {i === 0 && (
                      <span className="text-xs bg-consumer-600 text-white px-2 py-0.5 rounded-full font-semibold ml-2">
                        Best match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ★ {r.rating} · {r.dist} · {r.time}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-semibold ${r.fee === "Free delivery" ? "text-green-600" : "text-gray-500"}`}>
                    {r.fee}
                  </p>
                  <p className="text-xs text-consumer-600 font-bold mt-1 group-hover:underline">Select →</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Confirm & order */}
      {step === 3 && dish && restaurant && (
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(2)}
              className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">
              ← Back
            </button>
          </div>

          {/* Order summary */}
          <div className="bg-consumer-50 border border-consumer-200 rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-consumer-600 uppercase tracking-wide mb-3">Your order</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{dish.emoji}</span>
              <div>
                <p className="font-bold text-gray-900">{dish.name}</p>
                <p className="text-xs text-gray-500">{dish.cuisine} · from {restaurant.name}</p>
              </div>
              <span className="ml-auto font-bold text-consumer-700">{dish.price}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-3 border-t border-consumer-200">
              <span>🚗 {restaurant.time}</span>
              <span>📍 {restaurant.dist}</span>
              <span className={restaurant.fee === "Free delivery" ? "text-green-600 font-semibold" : ""}>
                {restaurant.fee}
              </span>
            </div>
          </div>

          {/* Delivery details */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Delivery address *
              </label>
              <input
                value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your address..."
                className="w-full border border-consumer-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Note for the kitchen <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Allergies, spice level, special requests..."
                rows={2}
                className="w-full border border-consumer-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
              />
            </div>
          </div>

          <button
            onClick={placeOrder}
            disabled={!address.trim() || submitting}
            className="w-full bg-consumer-600 text-white font-bold py-3.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {submitting ? (
              <><span className="animate-spin text-lg">🛵</span> Placing order...</>
            ) : (
              <>Place order · {dish.price}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
