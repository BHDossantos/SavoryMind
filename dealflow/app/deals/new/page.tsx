"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import DealForm from "@/components/DealForm";
import { createDealAction } from "@/lib/client/actions";
import { dealsKey } from "@/lib/client/api";

export default function NewDealPage() {
  const router = useRouter();
  const { status } = useSession();
  const authed = status === "authenticated";
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a deal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter what you know — the engine fills the rest.
        </p>
      </div>

      {error && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <DealForm
        submitLabel={busy ? "Saving…" : "Analyze deal"}
        onSubmit={async (input) => {
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
