import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

// Indicative price shown on the card. The real charge comes from the Stripe
// Price (STRIPE_RESTAURANT_PRICE_ID) — keep this label in sync with it.
const PRICE_LABEL = "€99";
const PRICE_PERIOD = "/mo";

export default function RestaurantBillingPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const checkoutResult = router.query.status; // "success" | "cancel" | undefined

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.getRestaurantBillingStatus();
      setStatus(s);
      if (s.is_pro && user?.plan !== "pro") updateUser({ plan: "pro" });
      return s;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [user, updateUser]);

  useEffect(() => {
    refreshStatus().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After checkout the webhook flips the plan server-side, but that can lag
  // the browser redirect. Poll briefly so the page resolves itself.
  useEffect(() => {
    if (checkoutResult !== "success" || !status || status.is_pro) {
      setSyncing(false);
      return;
    }
    setSyncing(true);
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const s = await refreshStatus();
      if ((s && s.is_pro) || tries >= 5) {
        clearInterval(timer);
        setSyncing(false);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [checkoutResult, status?.is_pro]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCheckout = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { url } = await api.createRestaurantCheckout();
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setActionLoading(false);
    }
  };

  const openPortal = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { url } = await api.createRestaurantPortal();
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message={t("common.loading")} />;

  const pro = (status && status.is_pro) || user?.plan === "pro";
  const billingLive = status?.billing_configured;
  const trialDays = status?.trial_days || 0;
  const periodEnd = status?.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString(i18n.language)
    : null;

  const FEATURES = [
    { icon: "📅", key: "bookings" },
    { icon: "🔔", key: "alerts" },
    { icon: "📊", key: "intelligence" },
    { icon: "🔗", key: "link" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">{t("restaurantBillingPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("restaurantBillingPage.subtitle")}</p>
      </div>

      {checkoutResult === "success" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {pro
            ? t("restaurantBillingPage.successActive")
            : syncing
              ? t("restaurantBillingPage.successActivating")
              : t("restaurantBillingPage.successPending")}
        </div>
      )}
      {checkoutResult === "cancel" && !pro && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t("restaurantBillingPage.canceled")}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {pro ? (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("restaurantBillingPage.onPlan")}</h2>
              <p className="text-sm text-gray-500">
                {status?.subscription_status === "trialing" ? (
                  <>
                    {t("restaurantBillingPage.trialActive")}
                    {periodEnd && ` ${t("restaurantBillingPage.trialEnds", { date: periodEnd })}`}
                  </>
                ) : (
                  <>
                    {t("restaurantBillingPage.subActive")}
                    {periodEnd && ` ${t("restaurantBillingPage.renews", { date: periodEnd })}`}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={openPortal}
            disabled={actionLoading}
            className="mt-6 bg-brand-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {actionLoading ? t("restaurantBillingPage.opening") : t("restaurantBillingPage.manageSub")}
          </button>
          <p className="text-xs text-gray-400 mt-3">{t("restaurantBillingPage.manageHint")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
            <p className="text-brand-200 text-sm font-medium uppercase tracking-wide">
              {t("restaurantBillingPage.planLabel")}
            </p>
            {trialDays > 0 && (
              <p className="text-brand-100 text-sm font-semibold mt-1">
                {t("restaurantBillingPage.trialThen", { days: trialDays })}
              </p>
            )}
            <p className="mt-1">
              <span className="text-4xl font-extrabold">{PRICE_LABEL}</span>
              <span className="text-brand-200">{PRICE_PERIOD}</span>
            </p>
          </div>
          <div className="p-6 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.key} className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t(`restaurantBillingPage.feat_${f.key}`)}</p>
                  <p className="text-xs text-gray-500">{t(`restaurantBillingPage.feat_${f.key}_desc`)}</p>
                </div>
              </div>
            ))}

            <button
              onClick={startCheckout}
              disabled={actionLoading || !billingLive}
              className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading
                ? t("restaurantBillingPage.startingCheckout")
                : trialDays > 0
                  ? t("restaurantBillingPage.startTrial", { days: trialDays })
                  : t("restaurantBillingPage.subscribeCta", { price: PRICE_LABEL, period: PRICE_PERIOD })}
            </button>

            {!billingLive && (
              <p className="text-xs text-amber-600 text-center">{t("restaurantBillingPage.billingOff")}</p>
            )}
            <p className="text-xs text-gray-400 text-center">{t("restaurantBillingPage.secureFootnote")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
