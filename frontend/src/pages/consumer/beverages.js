import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import PremiumGate from "../../components/PremiumGate";

const TABS = ["wine", "beer", "spirits"];
const TAB_ICONS = { wine: "🍷", beer: "🍺", spirits: "🥃" };
const TAB_LABEL_KEYS = { wine: "beveragesPage.tabWine", beer: "beveragesPage.tabBeer", spirits: "beveragesPage.tabSpirits" };

const CONFIDENCE_COLOR = (c) => c >= 0.8 ? "text-green-600" : c >= 0.6 ? "text-amber-600" : "text-gray-500";

export default function Beverages() {
  return (
    <PremiumGate
      feature="Beverage Pairings"
      blurb="Wine, beer and spirit pairings for any dish are part of SavoryMind Premium."
    >
      <BeveragesInner />
    </PremiumGate>
  );
}

function BeveragesInner() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("wine");
  const [dish, setDish] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!dish.trim()) return;
    setLoading(true); setError(null); setResults(null);
    try {
      let data;
      if (tab === "wine") data = await api.createWinePairing({ dish_name: dish, dish_description: "" });
      else if (tab === "beer") data = await api.getBeerPairing(dish);
      else data = await api.getSpiritsPairing(dish);
      setResults(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const pairings = results?.pairings || (results?.recommendations ? results.recommendations : []);
  const tabLabel = t(TAB_LABEL_KEYS[tab]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("beveragesPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("beveragesPage.subtitle")}</p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-6 bg-consumer-50 rounded-2xl p-1.5 w-fit">
        {TABS.map((tk) => (
          <button
            key={tk}
            onClick={() => { setTab(tk); setResults(null); setError(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === tk ? "bg-white shadow-sm text-consumer-700" : "text-gray-500 hover:text-consumer-600"}`}
          >
            {TAB_ICONS[tk]} {t(TAB_LABEL_KEYS[tk])}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-8 max-w-xl">
        <input
          value={dish}
          onChange={(e) => { setDish(e.target.value); setError(null); }}
          placeholder={t("beveragesPage.searchPh", { type: tabLabel.toLowerCase() })}
          className="flex-1 border border-consumer-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
        />
        <button
          type="submit" disabled={loading || !dish.trim()}
          className="bg-consumer-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors"
        >
          {loading ? t("beveragesPage.pairing") : t("beveragesPage.pair")}
        </button>
      </form>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* Results */}
      {pairings.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-4">
            {t("beveragesPage.topPairings", { type: tabLabel })} <span className="text-consumer-700">"{results.dish || results.dish_name}"</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pairings.map((p, i) => (
              <div key={i} className={`bg-white rounded-2xl border p-5 shadow-sm ${i === 0 ? "border-consumer-300 ring-2 ring-consumer-100" : "border-consumer-100"}`}>
                {i === 0 && <div className="text-xs font-bold text-consumer-600 mb-2 uppercase tracking-wide">{t("beveragesPage.topMatch")}</div>}
                <div className="text-3xl mb-2">{TAB_ICONS[tab]}</div>

                {tab === "wine" && (
                  <>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-500">{[p.flavor_profile, (p.regions || []).join(", ")].filter(Boolean).join(" · ")}</p>
                    <p className="text-xs text-consumer-600 mt-1">{p.style}</p>
                    <p className="mt-3 text-xs text-gray-600 leading-relaxed">{p.rationale || p.pairing_notes}</p>
                    <div className="mt-3 flex items-center gap-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-consumer-500 h-1.5 rounded-full" style={{ width: `${(p.confidence || 0.8) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${CONFIDENCE_COLOR(p.confidence || 0.8)}`}>{Math.round((p.confidence || 0.8) * 100)}%</span>
                    </div>
                    {p.serving_temp && <p className="mt-2 text-xs text-gray-400">🌡️ {p.serving_temp}</p>}
                  </>
                )}

                {tab === "beer" && (
                  <>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.style} · {t("beveragesPage.abv", { value: p.abv })}</p>
                    <p className="text-xs text-consumer-600 mt-1 italic">{p.flavour}</p>
                    <p className="mt-3 text-xs text-gray-600 leading-relaxed">{p.rationale}</p>
                    <div className="mt-3 flex items-center gap-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-consumer-500 h-1.5 rounded-full" style={{ width: `${(p.confidence || 0.75) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${CONFIDENCE_COLOR(p.confidence || 0.75)}`}>{Math.round((p.confidence || 0.75) * 100)}%</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">🍺 {p.serve}</p>
                  </>
                )}

                {tab === "spirits" && (
                  <>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.spirit} · {p.region}</p>
                    <p className="text-xs text-consumer-600 mt-1 italic">{p.flavour}</p>
                    <p className="mt-3 text-xs text-gray-600 leading-relaxed">{p.rationale}</p>
                    <div className="mt-3 flex items-center gap-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-consumer-500 h-1.5 rounded-full" style={{ width: `${(p.confidence || 0.75) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${CONFIDENCE_COLOR(p.confidence || 0.75)}`}>{Math.round((p.confidence || 0.75) * 100)}%</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">🥃 {p.serve}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty result — a search ran but matched nothing */}
      {results && pairings.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-2xl border border-consumer-100">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm text-gray-500">
            No {tabLabel.toLowerCase()} pairings found for &quot;{results.dish || results.dish_name || dish}&quot;. Try another dish.
          </p>
        </div>
      )}

      {/* Inspiration chips */}
      {!results && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-3">{t("beveragesPage.tryThese")}</p>
          <div className="flex flex-wrap gap-2">
            {["Beef Steak", "Grilled Salmon", "Spicy Thai Curry", "Margherita Pizza", "Chocolate Cake", "Caesar Salad", "BBQ Ribs"].map((d) => (
              <button key={d} onClick={() => setDish(d)} className="text-xs bg-consumer-50 text-consumer-700 border border-consumer-200 px-3 py-1.5 rounded-full hover:bg-consumer-100 transition-colors">
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
