import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

const PRIORITY_STYLES = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-green-50 text-green-700 border-green-200",
};

export default function MarketingPage() {
  const { t } = useTranslation();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await api.getMarketingInsights()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const ov = data.overview;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("marketingPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("marketingPage.subtitle")}</p>
      </div>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label={t("marketingPage.totalGuests")}   value={ov.total_guests} />
        <MetricCard label={t("marketingPage.vipGuests")}     value={ov.vip_guests} />
        <MetricCard label={t("marketingPage.retention")}     value={ov.retention_rate} />
        <MetricCard label={t("marketingPage.avgSpend")}      value={ov.avg_spend} />
        <MetricCard label={t("marketingPage.totalBookings")} value={ov.total_bookings} />
        <MetricCard label={t("marketingPage.fillRate")}      value={ov.booking_fill_rate} />
        <MetricCard label={t("marketingPage.cancelRate")}    value={ov.cancel_rate} danger />
      </div>

      {/* Action items */}
      {data.actions?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">{t("marketingPage.actionItems")}</h2>
          <div className="space-y-3">
            {data.actions.map((a, i) => (
              <div key={i} className={`flex items-start gap-4 bg-white border rounded-2xl p-5 ${PRIORITY_STYLES[a.priority]}`}>
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-bold text-gray-900">{a.title}</p>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[a.priority]}`}>
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {data.tips?.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-4">{t("marketingPage.marketingTips")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.tips.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-3 hover:shadow-sm transition-all">
                <span className="text-2xl">{t.icon}</span>
                <p className="text-sm text-gray-700 leading-relaxed">{t.tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, danger }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
      <p className={`text-2xl font-bold ${danger ? "text-red-500" : "text-brand-600"}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
    </div>
  );
}
