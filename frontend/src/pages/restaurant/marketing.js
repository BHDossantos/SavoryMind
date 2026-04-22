import { useState, useEffect } from "react";
import { api } from "../../services/api";
import Layout from "../../components/Layout";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

const PRIORITY_STYLES = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-green-50 text-green-700 border-green-200",
};

export default function MarketingPage() {
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

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (error)   return <Layout><ErrorMessage message={error} onRetry={load} /></Layout>;

  const ov = data.overview;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">💌 Marketing & Guests</h1>
        <p className="text-gray-400 mt-1">Guest acquisition, retention, and loyalty insights</p>
      </div>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Guests"  value={ov.total_guests} />
        <MetricCard label="VIP Guests"    value={ov.vip_guests} />
        <MetricCard label="Retention"     value={ov.retention_rate} />
        <MetricCard label="Avg Spend"     value={ov.avg_spend} />
        <MetricCard label="Total Bookings" value={ov.total_bookings} />
        <MetricCard label="Fill Rate"     value={ov.booking_fill_rate} />
        <MetricCard label="Cancel Rate"   value={ov.cancel_rate} danger />
      </div>

      {/* Action items */}
      {data.actions?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">Action Items</h2>
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
          <h2 className="text-base font-bold text-gray-900 mb-4">Marketing Tips</h2>
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
    </Layout>
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
