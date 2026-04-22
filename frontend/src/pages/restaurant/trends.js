import { useState, useEffect } from "react";
import { api } from "../../services/api";
import Layout from "../../components/Layout";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

export default function TrendsPage() {
  const [data, setData]     = useState(null);
  const [tab, setTab]       = useState("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await api.getMenuTrends()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (error)   return <Layout><ErrorMessage message={error} onRetry={load} /></Layout>;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🚀 Trend Alerts</h1>
        <p className="text-gray-400 mt-1">
          {data.total_items} menu items · {data.total_reviews} reviews analysed
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[["menu", "Your Menu Trends"], ["global", "Global Food Trends"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-6 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === key ? "border-brand-500 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "menu" && (
        <div className="space-y-8">
          <TrendSection title="🚀 Rising Stars" items={data.rising_stars}
            empty="Add more menu items and reviews to unlock rising star insights." />
          <TrendSection title="💎 Hidden Gems" items={data.hidden_gems}
            empty="No high-margin underperformers found — great work!" />
          <TrendSection title="⚠️ At Risk" items={data.at_risk}
            empty="All items have healthy sentiment — nothing at risk." />
        </div>
      )}

      {tab === "global" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.global_trends.map((g, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-brand-200 hover:shadow-sm transition-all">
              <p className="font-bold text-gray-900 text-base mb-2">{g.trend}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{g.insight}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

function TrendSection({ title, items, empty }) {
  return (
    <div>
      <h2 className="text-base font-bold text-gray-900 mb-4">{title}</h2>
      {!items || items.length === 0 ? (
        <p className="text-sm text-gray-400 italic bg-gray-50 rounded-xl px-4 py-3">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900">{item.name}</h3>
                <span className="font-bold text-brand-600">${item.price}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {item.category} · {item.orders} orders · {item.margin}% margin · {item.reviews} reviews
              </p>
              <p className="text-sm text-gray-700 italic leading-relaxed">{item.insight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
