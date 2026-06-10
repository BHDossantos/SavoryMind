"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import DealForm from "@/components/DealForm";
import UpgradePrompt from "@/components/UpgradePrompt";
import { createDealAction } from "@/lib/client/actions";
import { dealsKey } from "@/lib/client/api";
import { useDealsSource } from "@/lib/client/use-deals";
import { useBillingSource } from "@/lib/client/use-billing";

export default function NewDealPage() {
  const router = useRouter();
  const { status } = useSession();
  const authed = status === "authenticated";
  const { mutate } = useSWRConfig();
  const { deals } = useDealsSource();
  const { data: billing } = useBillingSource();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const atLimit =
    authed &&
    billing.limits.maxDeals !== null &&
    deals.length >= billing.limits.maxDeals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a deal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter what you know — the engine fills the rest.
        </p>
      </div>

      {atLimit && (
        <UpgradePrompt
          title={`Free plan limit reached (${billing.limits.maxDeals} deals)`}
          body="Upgrade to Pro to add more — unlimited deals plus AI analysis."
          source="new_deal_limit"
        />
      )}

      {error && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <DealForm
        submitLabel={busy ? "Saving…" : "Analyze deal"}
        onSubmit={async (input) => {
          if (atLimit) return;
          setError(null);
          setBusy(true);
          try {
            const deal = await createDealAction(authed, input);
            if (authed) await mutate(dealsKey);
            router.push(`/deals/${deal.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save deal");
            setBusy(false);
          }
        }}
        onCancel={() => router.push("/")}
      />
    </div>
  );
}
