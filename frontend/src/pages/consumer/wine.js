import { useState, useEffect } from "react";
import { api } from "../../services/api";

const CONFIDENCE_COLOR = (c) => c >= 0.85 ? "text-green-600" : c >= 0.70 ? "text-yellow-600" : "text-gray-500";

export default function WinePairing() {
  const [form, setForm] = useState({ dish_name: "", dish_description: "" });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getWinePairings().then(setHistory).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dish_name.trim()) { setError("Please enter a dish name."); return; }
    setLoading(true); setError(null);
    try {
      const data = await api.createWinePairing(form);
      setResult(data);
      setHistory((h) => [data, ...h]);
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const displayPairing = selected || result;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🍷 Wine Pairing</h1>
        <p className="text-gray-400 mt-1">Describe any dish and get AI-matched wine recommendations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
            <h2 className="font-semibold text-gray-800 mb-4">Your Dish</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dish name *</label>
                <input
                  value={form.dish_name}
                  onChange={(e) => { setForm((f) => ({ ...f, dish_name: e.target.value })); setError(null); }}
                  placeholder="e.g. Grilled Salmon, Beef Steak, Truffle Pasta..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={form.dish_description}
                  onChange={(e) => setForm((f) => ({ ...f, dish_description: e.target.value }))}
                  rows={3}
                  placeholder="Cooking method, sauces, key ingredients..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-consumer-600 text-white font-semibold py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors"
              >
                {loading ? "Finding pairings..." : "Find Wine Pairings →"}
              </button>
            </form>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
              <h2 className="font-semibold text-gray-800 mb-3">Previous Pairings</h2>
              <div className="space-y-2">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setSelected(h); setResult(null); }}
                    className={`w-full text-left p-3 rounded-xl text-sm transition-colors ${selected?.id === h.id ? "bg-consumer-100 text-consumer-700" : "hover:bg-gray-50 text-gray-700"}`}
                  >
                    <span className="font-medium">{h.dish_name}</span>
                    <span className="text-gray-400 ml-2 text-xs">→ {h.recommendations?.[0]?.name || "—"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Result */}
        <div className="lg:col-span-3">
          {!displayPairing ? (
            <div className="h-full bg-white rounded-2xl p-12 shadow-sm border border-consumer-100 flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4">🍷</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Ready to pair</h3>
              <p className="text-gray-400 text-sm max-w-xs">Enter a dish on the left and our AI will find the perfect wine match for you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-consumer-600 rounded-2xl p-5 text-white">
                <p className="text-consumer-200 text-sm font-medium">Pairings for</p>
                <h2 className="text-xl font-bold mt-1">{displayPairing.dish_name}</h2>
                {displayPairing.dish_description && (
                  <p className="text-consumer-200 text-sm mt-1">{displayPairing.dish_description}</p>
                )}
              </div>

              {displayPairing.recommendations.map((wine, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🍾</span>
                        <h3 className="font-bold text-gray-900">{wine.name}</h3>
                        {i === 0 && <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full font-semibold">Best Match</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{wine.style}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-bold ${CONFIDENCE_COLOR(wine.confidence)}`}>
                        {Math.round(wine.confidence * 100)}%
                      </p>
                      <p className="text-xs text-gray-400">match</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 italic mb-4 leading-relaxed border-l-4 border-consumer-200 pl-3">{wine.rationale}</p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 mb-1 font-medium">Flavor Profile</p>
                      <p className="text-gray-700">{wine.flavor_profile}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 mb-1 font-medium">Where to find</p>
                      <p className="text-gray-700">{wine.regions.join(", ")}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 mb-1 font-medium">Serve at</p>
                      <p className="text-gray-700">{wine.serving_temp}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 mb-1 font-medium">Price Range</p>
                      <p className="text-gray-700">{wine.price_range}</p>
                    </div>
                  </div>

                  {wine.decant && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                      <span>⏱</span> Decant for {wine.decant_time} before serving
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
