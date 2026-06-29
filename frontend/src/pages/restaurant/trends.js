import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

export default function TrendsPage() {
  const { t } = useTranslation();
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

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("trendsPage.title")}</h1>
        <p className="text-gray-400 mt-1">
          {t("trendsPage.subtitleStats", { items: data.total_items, reviews: data.total_reviews })}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[["menu", t("trendsPage.tabMenu")], ["global", t("trendsPage.tabGlobal")]].map(([key, label]) => (
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
          <TrendSection title={t("trendsPage.risingStars")} items={data.rising_stars}
            empty={t("trendsPage.risingEmpty")} />
          <TrendSection title={t("trendsPage.hiddenGems")} items={data.hidden_gems}
            empty={t("trendsPage.hiddenEmpty")} />
          <TrendSection title={t("trendsPage.atRisk")} items={data.at_risk}
            empty={t("trendsPage.atRiskEmpty")} />
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
    </div>
  );
}

function TrendSection({ title, items, empty }) {
  const { t } = useTranslation();
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
                {t("trendsPage.itemStats", {
                  category: item.category,
                  orders:   item.orders,
                  margin:   item.margin,
                  reviews:  item.reviews,
                })}
              </p>
              <p className="text-sm text-gray-700 italic leading-relaxed">{item.insight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
