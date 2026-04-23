import { useState, useEffect } from "react";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

const DIETARY_OPTIONS = [
  { value: "",           label: "All" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan",      label: "Vegan" },
  { value: "keto",       label: "Keto" },
  { value: "gluten_free",label: "Gluten-Free" },
  { value: "dairy_free", label: "Dairy-Free" },
];

export default function PlannerPage() {
  const [tab, setTab]           = useState("plan");
  const [dietary, setDietary]   = useState("");
  const [plan, setPlan]         = useState(null);
  const [shopping, setShopping] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = async (d = dietary) => {
    setLoading(true); setError(null);
    try {
      const [p, s, sug] = await Promise.all([
        api.getMealPlan(d),
        api.getShoppingList(d),
        api.getDailySuggestion(),
      ]);
      setPlan(p); setShopping(s); setSuggestion(sug);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDietary = (d) => { setDietary(d); load(d); };

  if (loading) return <div><LoadingSpinner /></div>;
  if (error)   return <div><ErrorMessage message={error} onRetry={() => load()} /></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">📅 Meal Planner</h1>
        <p className="text-gray-400 mt-1">Your personalised 7-day plan with shopping list</p>
      </div>

      {/* Today's suggestion */}
      {suggestion && (
        <div className="bg-consumer-50 border border-consumer-200 rounded-2xl p-5 mb-6">
          <p className="text-xs font-semibold text-consumer-600 uppercase tracking-wide mb-1">
            Today — {suggestion.day}
          </p>
          <p className="text-sm text-gray-500 mb-2">{suggestion.reason}</p>
          <div className="flex items-center gap-4">
            <span className="text-4xl">{suggestion.suggestion.image_emoji || "🍽️"}</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">{suggestion.suggestion.title}</p>
              <p className="text-sm text-gray-500">
                {suggestion.suggestion.cuisine} · {suggestion.suggestion.time_minutes} min · {suggestion.suggestion.difficulty}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dietary filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs font-semibold text-gray-500 self-center mr-1">Diet:</span>
        {DIETARY_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => handleDietary(opt.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              dietary === opt.value
                ? "bg-consumer-600 text-white"
                : "bg-white text-gray-600 border border-consumer-200 hover:border-consumer-400"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 mb-6">
        {[["plan", "Weekly Plan"], ["shopping", "Shopping List"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-6 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === key ? "border-consumer-600 text-consumer-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Weekly plan */}
      {tab === "plan" && plan && (
        <div className="space-y-4">
          {plan.days.map((day) => (
            <div key={day.day} className="bg-white rounded-2xl border border-consumer-100 overflow-hidden">
              <div className="bg-consumer-50 px-5 py-3 border-b border-consumer-100">
                <h3 className="font-bold text-consumer-700">{day.day}</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <MealCard label="Lunch" meal={day.lunch} />
                <MealCard label="Dinner" meal={day.dinner} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shopping list */}
      {tab === "shopping" && shopping && (
        <div>
          <p className="text-sm text-gray-500 mb-4">{shopping.total_items} items for your week</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(shopping.categories).map(([cat, items]) => (
              <div key={cat} className="bg-white rounded-2xl border border-consumer-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3">{cat}</h3>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-consumer-500 font-bold mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MealCard({ label, meal }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl">{meal.emoji}</span>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="font-semibold text-gray-900">{meal.name}</p>
        <p className="text-xs text-gray-500">{meal.cuisine} · {meal.time_minutes} min</p>
      </div>
    </div>
  );
}
