import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const TREND_ICON = { rising: "📈", stable: "➡️", declining: "📉" };
const TREND_COLOR = { rising: "text-green-600", stable: "text-gray-600", declining: "text-red-500" };
const TREND_LABEL_KEYS = {
  rising: "predictionsPage.trendRising",
  stable: "predictionsPage.trendStable",
  declining: "predictionsPage.trendDeclining",
};

export default function Predictions() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = () => {
    setLoading(true);
    api.getPredictions()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <LoadingSpinner message={t("predictionsPage.loading")} />;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;
  if (!data) return null;

  const chartData = data.top_items.slice(0, 6).map((item) => ({
    name: item.name.split(" ").slice(0, 2).join(" "),
    orders: item.predicted_orders,
    revenue: item.predicted_revenue,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("predictionsPage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("predictionsPage.subtitle")}</p>
        </div>
        <button onClick={refresh} className="text-sm text-brand-600 font-medium hover:underline">{t("predictionsPage.refresh")}</button>
      </div>

      {/* Context banner */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-700 text-white rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-brand-100 text-sm">{data.day_label}</p>
            <h2 className="text-xl font-bold mt-1">{data.window_label}</h2>
          </div>
          <div className="text-right">
            <p className="text-brand-100 text-xs">{t("predictionsPage.predictedRevenue")}</p>
            <p className="text-3xl font-bold mt-0.5">${data.total_predicted_revenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{t("predictionsPage.predictedOrdersByItem")}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: -10, right: 0, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="orders" radius={[4, 4, 0, 0]} name={t("predictionsPage.predictedOrdersLegend")}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${25 + i * 12}, 90%, ${55 - i * 4}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Prep & Staffing */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">{t("predictionsPage.staffingNote")}</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{data.staffing_note}</p>
          </div>

          {data.recommended_prep.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">{t("predictionsPage.prepChecklist")}</h3>
              <div className="space-y-2">
                {data.recommended_prep.map((item, i) => (
                  <label key={i} className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5 accent-brand-500" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full item list */}
      <div className="mt-6 card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t("predictionsPage.fullPredictions")}</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{t("predictionsPage.colItem")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("predictionsPage.colCategory")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("predictionsPage.colPredOrders")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("predictionsPage.colRevenue")}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("predictionsPage.colTrend")}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("predictionsPage.colConfidence")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.top_items.map((item, i) => {
              const trendLabel = TREND_LABEL_KEYS[item.trend] ? t(TREND_LABEL_KEYS[item.trend]) : item.trend;
              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{item.predicted_orders}</td>
                  <td className="px-4 py-3 text-right text-brand-700 font-semibold">${item.predicted_revenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`${TREND_COLOR[item.trend]} font-medium`}>
                      {TREND_ICON[item.trend]} {trendLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-16 bg-gray-100 rounded-full h-2">
                        <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${item.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(item.confidence * 100)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        {t("predictionsPage.footer")}
      </p>
    </div>
  );
}
