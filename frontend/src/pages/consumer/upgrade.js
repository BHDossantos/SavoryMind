import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

// Indicative price shown on the card. The amount actually charged comes from
// the Stripe Price (STRIPE_PRICE_ID) — keep this label in sync with it.
const PRICE_LABEL = "$9";
const PRICE_PERIOD = "/month";

const PREMIUM_FEATURES = [
  { icon: "📅", title: "Meal planner", desc: "Weekly meal plans with auto-built shopping lists." },
  { icon: "🍷", title: "Wine & beverage pairings", desc: "Pair any dish with the right wine, beer or spirit." },
  { icon: "🎵", title: "Music moods", desc: "A soundtrack matched to your meal and the moment." },
  { icon: "🥂", title: "The cellar", desc: "Browse the full wine, beer & spirits catalog." },
];

export default function UpgradePage() {
  const router = useRouter();
  const { isPremium, updateUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const checkoutResult = router.query.status; // "success" | "cancel" | undefined

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.getBillingStatus();
      setStatus(s);
      if (s.is_premium && !isPremium) updateUser({ plan: "premium" });
      return s;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [isPremium, updateUser]);

  useEffect(() => {
    refreshStatus().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After Stripe checkout, the webhook flips the plan to Premium server-side,
  // but that can lag the browser redirect by a few seconds. Poll briefly so
  // the page resolves itself instead of showing a stale "free" state.
  useEffect(() => {
    if (checkoutResult !== "success" || !status || status.is_premium) {
      setSyncing(false);
      return;
    }
    setSyncing(true);
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const s = await refreshStatus();
      if ((s && s.is_premium) || tries >= 5) {
        clearInterval(timer);
        setSyncing(false);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [checkoutResult, status?.is_premium]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCheckout = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const { url } = await api.createCheckout();
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
      const { url } = await api.createBillingPortal();
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading…" />;

  const premium = (status && status.is_premium) || isPremium;
  const billingLive = status?.billing_configured;
  const trialDays = status?.trial_days || 0;
  const periodEnd = status?.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">SavoryMind Premium</h1>
        <p className="text-gray-400 mt-1">
          Unlock the planner, pairings, music and cellar.
        </p>
      </div>

      {checkoutResult === "success" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {premium ? (
            <>🎉 You're on Premium — everything's unlocked. Enjoy!</>
          ) : syncing ? (
            <>Payment received — activating your subscription, one moment…</>
          ) : (
            <>
              Payment received. If Premium isn't active yet, refresh this page
              in a few seconds.
            </>
          )}
        </div>
      )}
      {checkoutResult === "cancel" && !premium && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Checkout canceled — no charge was made. You can upgrade any time.
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {premium ? (
        <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">You're on Premium</h2>
              <p className="text-sm text-gray-500">
                {status?.subscription_status === "trialing" ? (
                  <>
                    You&apos;re in your free trial.
                    {periodEnd && ` It ends ${periodEnd} — first charge then.`}
                  </>
                ) : (
                  <>
                    Your subscription is active.
                    {periodEnd && ` Renews ${periodEnd}.`}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={openPortal}
            disabled={actionLoading}
            className="mt-6 bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors"
          >
            {actionLoading ? "Opening…" : "Manage subscription"}
          </button>
          <p className="text-xs text-gray-400 mt-3">
            Update your card or cancel any time in the billing portal.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-consumer-600 to-consumer-800 p-6 text-white">
            <p className="text-consumer-200 text-sm font-medium uppercase tracking-wide">
              Premium
            </p>
            {trialDays > 0 && (
              <p className="text-consumer-100 text-sm font-semibold mt-1">
                {trialDays} days free, then
              </p>
            )}
            <p className="mt-1">
              <span className="text-4xl font-extrabold">{PRICE_LABEL}</span>
              <span className="text-consumer-200">{PRICE_PERIOD}</span>
            </p>
          </div>
          <div className="p-6 space-y-4">
            {PREMIUM_FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}

            <button
              onClick={startCheckout}
              disabled={actionLoading || !billingLive}
              className="w-full bg-consumer-600 text-white font-semibold py-3 rounded-xl hover:bg-consumer-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading
                ? "Starting checkout…"
                : trialDays > 0
                  ? `Start ${trialDays}-day free trial`
                  : `Upgrade — ${PRICE_LABEL}${PRICE_PERIOD}`}
            </button>

            {!billingLive && (
              <p className="text-xs text-amber-600 text-center">
                Billing isn't switched on yet — check back soon.
              </p>
            )}
            <p className="text-xs text-gray-400 text-center">
              {trialDays > 0 && `Then ${PRICE_LABEL}${PRICE_PERIOD} after your trial. `}
              Secure checkout by Stripe. Cancel any time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
