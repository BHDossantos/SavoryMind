"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DealForm from "@/components/DealForm";
import { useDealSource } from "@/lib/client/use-deals";
import { updateDealAction } from "@/lib/client/actions";

export default function EditDealPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const { deal, isLoading, error, authed, refresh } = useDealSource(id);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading && !deal) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">Loading…</div>
    );
  }

  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        Couldn&rsquo;t load deal: {error.message}.{" "}
        <Link href="/" className="underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="card p-8 text-center text-sm text-slate-600">
        Deal not found.{" "}
        <Link href="/" className="text-brand-600 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit deal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update {deal.name}. Analysis recomputes automatically.
        </p>
      </div>
      {submitError && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {submitError}
        </div>
      )}
      <DealForm
        initial={deal}
        submitLabel={busy ? "Saving…" : "Save changes"}
        onSubmit={async (input) => {
          setSubmitError(null);
          setBusy(true);
          try {
            await updateDealAction(authed, id, input);
            await refresh();
            router.push(`/deals/${id}`);
          } catch (e) {
            setSubmitError(
              e instanceof Error ? e.message : "Failed to save deal",
            );
            setBusy(false);
          }
        }}
        onCancel={() => router.push(`/deals/${id}`)}
      />
    </div>
  );
}
