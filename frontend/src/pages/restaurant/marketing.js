import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

const PRIORITY_STYLES = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-green-50 text-green-700 border-green-200",
};

// One-click campaign generator. The operator names the dish they want to
// promote; Claude returns ready-to-paste copy for Instagram, WhatsApp,
// email, and SMS. Falls back to a localized template when Claude isn't
// configured so the flow never dead-ends.
function CampaignGenerator({ initialDish = "" }) {
  const { t } = useTranslation();
  const [dish, setDish]       = useState(initialDish);
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState(null);

  // Pre-fill from ?promote=Dish query param so the "Create campaign" CTA on
  // /recommendations can deep-link straight to a primed form.
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.promote) setDish(String(router.query.promote));
  }, [router.isReady, router.query.promote]);

  const generate = async () => {
    if (!dish.trim()) { setError(t("marketingPage.dishRequired")); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const c = await api.generateCampaign({ dish: dish.trim(), notes: notes.trim() });
      setResult(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  };

  const channels = result
    ? [
        { key: "instagram_caption", label: "Instagram", icon: "📷", text: result.instagram_caption },
        { key: "whatsapp_message",  label: "WhatsApp",  icon: "💬", text: result.whatsapp_message },
        { key: "email_subject",     label: t("marketingPage.emailSubject"), icon: "✉️", text: result.email_subject },
        { key: "email_body",        label: t("marketingPage.emailBody"),    icon: "📧", text: result.email_body },
        { key: "sms_body",          label: "SMS",       icon: "📱", text: result.sms_body },
      ]
    : [];

  return (
    <section className="mb-8 bg-gradient-to-br from-brand-50 to-white rounded-2xl border border-brand-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-xs font-bold text-brand-700 uppercase tracking-wider">
            {t("marketingPage.campaignEyebrow")}
          </p>
          <h2 className="text-lg font-extrabold text-gray-900">
            {t("marketingPage.campaignTitle")}
          </h2>
        </div>
        <span className="text-2xl" aria-hidden>🚀</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          placeholder={t("marketingPage.dishPlaceholder")}
          className="md:col-span-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("marketingPage.notesPlaceholder")}
          className="md:col-span-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          onClick={generate}
          disabled={loading}
          className="bg-brand-600 text-white font-bold py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? t("marketingPage.generating") : t("marketingPage.generateCta")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {result && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-800">{result.headline}</p>
          {channels.map((c) => (
            <div key={c.key} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <span className="mr-1">{c.icon}</span>{c.label}
                </p>
                <button
                  onClick={() => copy(c.key, c.text)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  {copied === c.key ? t("marketingPage.copied") : t("marketingPage.copy")}
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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

      <CampaignGenerator />

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
