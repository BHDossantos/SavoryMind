"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBillingSource } from "@/lib/client/use-billing";

export default function BillingSuccessPage() {
  // SWR polls every 2 seconds; the success page sits here until Stripe's
  // webhook flips the workspace tier or we time out.
  const { data, isLoading, authed } = useBillingSource(2000);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tier = data.effectiveTier;
  const isPaid = tier === "pro" || tier === "team";
  const timedOut = elapsed > 15;

  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-8 text-center">
        {!authed ? (
          <>
            <h1 className="text-xl font-semibold">Sign in to continue</h1>
            <p className="mt-2 text-sm text-slate-600">
              We can&rsquo;t see your account from here. Sign in to confirm
              your upgrade.
            </p>
            <Link href="/login" className="btn-primary mt-5 inline-flex">
              Log in
            </Link>
          </>
        ) : isPaid ? (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="mt-2 text-xl font-semibold">
              Welcome to {tier === "team" ? "Team" : "Pro"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Your subscription is active. Unlimited deals + Claude analysis
              are unlocked.
            </p>
            <Link href="/" className="btn-primary mt-5 inline-flex">
              Go to dashboard
            </Link>
          </>
        ) : timedOut ? (
          <>
            <h1 className="text-xl font-semibold">Almost there</h1>
            <p className="mt-2 text-sm text-slate-600">
              Stripe is still processing your subscription. This usually
              resolves within a minute. Refresh in a moment or check
              settings.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <Link href="/settings/billing" className="btn-ghost">
                Billing settings
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Activating your plan…</h1>
            <p className="mt-2 text-sm text-slate-600">
              Waiting for Stripe to confirm your subscription. Hang on.
            </p>
            <div className="mt-5 text-xs text-slate-400">
              {isLoading ? "Checking…" : `${elapsed}s`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
