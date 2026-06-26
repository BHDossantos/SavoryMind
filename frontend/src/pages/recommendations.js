import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api } from "../services/api";
import clsx from "clsx";

// Each recommendation type maps to a single concrete action the operator
// can take in one tap. Driven by the audit's central thesis: "AI should
// not just answer questions — AI should create actions inside the app."
const TYPE_CONFIG = {
  price_increase: {
    icon: "💰", labelKey: "recommendationsPage.typeRaisePrice",
    color: "bg-orange-50 border-orange-200",
    actionKey: "recommendationsPage.actionUpdatePrice",
    actionRoute: "/menu",
  },
  promotion: {
    icon: "📣", labelKey: "recommendationsPage.typePromotion",
    color: "bg-blue-50 border-blue-200",
    actionKey: "recommendationsPage.actionCreateCampaign",
    actionRoute: "/restaurant/marketing",
  },
  quality_review: {
    icon: "⚠️", labelKey: "recommendationsPage.typeQualityReview",
    color: "bg-red-50 border-red-200",
    actionKey: "recommendationsPage.actionOpenMenu",
    actionRoute: "/menu",
  },
  star_item: {
    icon: "⭐", labelKey: "recommendationsPage.typeStarItem",
    color: "bg-green-50 border-green-200",
    actionKey: "recommendationsPage.actionFeature",
    actionRoute: "/restaurant/marketing",
  },
};

const PRIORITY_BADGE = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

const PRIORITY_LABEL_KEYS = {
  high:   "recommendationsPage.priorityHigh",
  medium: "recommendationsPage.priorityMedium",
  low:    "recommendationsPage.priorityLow",
};

const FILTER_LABELS = {
  all:    "recommendationsPage.filterAll",
  high:   "recommendationsPage.filterHigh",
  medium: "recommendationsPage.filterMedium",
  low:    "recommendationsPage.filterLow",
};

export default function RecommendationsPage() {
  const { t } = useTranslation();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const fetchData = () => {
    setLoading(true); setError(null);
    api.getRecommendations()
      .then(setRecs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message={t("recommendationsPage.loading")} />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const filtered = filter === "all" ? recs : recs.filter((r) => r.priority === filter);

  const highCount = recs.filter((r) => r.priority === "high").length;
  const medCount = recs.filter((r) => r.priority === "medium").length;
  const totalGain = recs.reduce((sum, r) => sum + (r.potential_gain || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("recommendationsPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("recommendationsPage.subtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-500">{highCount}</p>
          <p className="text-sm text-gray-500 mt-1">{t("recommendationsPage.highPriority")}</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-500">{medCount}</p>
          <p className="text-sm text-gray-500 mt-1">{t("recommendationsPage.medPriority")}</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">${totalGain.toFixed(0)}</p>
          <p className="text-sm text-gray-500 mt-1">{t("recommendationsPage.potentialGain")}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["all", "high", "medium", "low"].map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === p ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            )}
          >
            {t(FILTER_LABELS[p])}
          </button>
        ))}
      </div>

      {/* Recommendations */}
      {filtered.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-semibold text-gray-700">{t("recommendationsPage.emptyTitle")}</p>
          <p className="text-gray-400 text-sm mt-1">{t("recommendationsPage.emptySub")}</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((rec, i) => {
          const config = TYPE_CONFIG[rec.type] || { icon: "💡", labelKey: "recommendationsPage.tip", color: "bg-gray-50 border-gray-200" };
          const priorityLabel = PRIORITY_LABEL_KEYS[rec.priority] ? t(PRIORITY_LABEL_KEYS[rec.priority]) : rec.priority.toUpperCase();
          return (
            <div key={i} className={clsx("card border", config.color)}>
              <div className="flex items-start gap-4">
                <div className="text-3xl mt-1">{config.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{rec.item}</h3>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-500">{rec.category}</span>
                    <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full ml-auto", PRIORITY_BADGE[rec.priority])}>
                      {priorityLabel}
                    </span>
                  </div>
                  <span className="inline-block text-xs bg-white border border-gray-200 rounded-md px-2 py-0.5 text-gray-600 mb-2">
                    {t(config.labelKey)}
                  </span>
                  <p className="text-sm text-gray-700">{rec.message}</p>
                  {rec.potential_gain > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-2">
                      {t("recommendationsPage.gainLine", { amount: rec.potential_gain.toFixed(0) })}
                    </p>
                  )}
                  {config.actionKey && (
                    <Link
                      href={config.actionRoute}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-lg mt-3 hover:bg-gray-700"
                    >
                      {t(config.actionKey)} <span>→</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
