import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { api } from "../../services/api";
import { fmtEur } from "../../components/restaurant/LossReveal";

const BAND_STYLE = {
  excellent: "text-green-700", good: "text-green-600",
  fair: "text-amber-600", needs_attention: "text-red-600", learning: "text-gray-500",
};

export default function DigitalTwinPage() {
  const { t, i18n } = useTranslation();
  const [twin, setTwin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getDigitalTwin()
      .then(setTwin).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400 animate-pulse">{t("aios.twinLoading")}</div>;
  if (error || !twin) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-500">{t("aios.twinError")}</div>;

  const wh = twin.what_happened || {};
  const why = twin.why || {};
  const tomorrow = twin.tomorrow || {};
  const res = tomorrow.reservations || {};
  const actions = twin.today_actions || [];

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-500">{t("aios.twinEyebrow")}</p>
      <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{twin.restaurant_name}</h1>
      <p className="text-lg text-gray-700 mt-2">{twin.headline}</p>

      {/* What happened */}
      <Section title={t("aios.whatHappened")}>
        {wh.has_data ? (
          <div className="flex flex-wrap gap-8">
            <Stat label={t("aios.yesterdayRevenue")} value={fmtEur(wh.revenue || 0, i18n.language)} big />
            {wh.profit != null && <Stat label={t("aios.yesterdayProfit")} value={fmtEur(wh.profit, i18n.language)} />}
            {wh.weekday_baseline != null && <Stat label={t("aios.weekdayBaseline")} value={fmtEur(wh.weekday_baseline, i18n.language)} />}
          </div>
        ) : <p className="text-gray-500">{t("aios.noYesterday")}</p>}
      </Section>

      {/* Why */}
      {(why.drivers?.length > 0 || why.narrative) && (
        <Section title={t("aios.why")}>
          {why.narrative && <p className="text-gray-700 mb-3 leading-relaxed">{why.narrative}</p>}
          <ul className="space-y-1.5">
            {(why.drivers || []).map((d, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-brand-400">•</span><span>{d}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {/* Tomorrow */}
      <Section title={t("aios.tomorrow")}>
        {res.has_data ? (
          <div className="flex flex-wrap gap-8">
            <Stat label={t("aios.covers")} value={`~${res.predicted_covers}`} big />
            {res.predicted_walk_ins != null && <Stat label={t("aios.walkIns")} value={`~${res.predicted_walk_ins}`} />}
            {res.expected_revenue != null && <Stat label={t("aios.expectedRevenue")} value={fmtEur(res.expected_revenue, i18n.language)} />}
            {tomorrow.predicted_sales_revenue != null && <Stat label={t("aios.predictedSales")} value={fmtEur(tomorrow.predicted_sales_revenue, i18n.language)} />}
          </div>
        ) : <p className="text-gray-500">{t("aios.tomorrowEmpty")}</p>}
      </Section>

      {/* Today's actions */}
      <Section title={t("aios.todayActions")}>
        {actions.length > 0 ? (
          <>
            {twin.today_action_value > 0 && (
              <p className="text-sm text-brand-700 font-semibold mb-2">
                {t("aios.actionValue", { value: fmtEur(twin.today_action_value, i18n.language) })}
              </p>
            )}
            <ul className="space-y-2">
              {actions.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border border-gray-100 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.title || a.label}</p>
                    {a.detail && <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>}
                  </div>
                  {a.estimated_gain > 0 && (
                    <span className="text-xs font-bold text-brand-700 flex-shrink-0">
                      +{fmtEur(a.estimated_gain, i18n.language)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : <p className="text-gray-500">{t("aios.noActions")}</p>}
      </Section>

      {/* Health */}
      <Section title={t("aios.healthTitle")}>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-extrabold ${BAND_STYLE[twin.health?.band] || "text-gray-700"}`}>
            {twin.health?.overall != null ? twin.health.overall : "—"}
          </span>
          <span className="text-sm text-gray-400">/100</span>
          <span className={`ml-auto text-sm font-semibold ${BAND_STYLE[twin.health?.band]}`}>
            {twin.health?.band && t(`aios.band.${twin.health.band}`)}
          </span>
        </div>
      </Section>

      <Link href="/dashboard" className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-700">← {t("aios.backToDashboard")}</Link>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-6 bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, big }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`${big ? "text-2xl" : "text-lg"} font-bold text-gray-900`}>{value}</p>
    </div>
  );
}
