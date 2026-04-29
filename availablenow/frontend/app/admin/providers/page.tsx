"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, type ApprovalStatus, type Provider } from "@/lib/api";

const STATUSES: (ApprovalStatus | "all")[] = ["all", "pending", "approved", "suspended"];

export default function AdminProvidersPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (params.get("status") as ApprovalStatus | null) || "all";
  const [items, setItems] = useState<Provider[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setItems(null);
    api
      .adminProviders(status === "all" ? undefined : status)
      .then(setItems)
      .catch((e) => setError(String(e.message || e)));
  }

  useEffect(load, [status]);

  function setStatus(next: string) {
    const qs = new URLSearchParams(params.toString());
    if (next === "all") qs.delete("status");
    else qs.set("status", next);
    router.push(`/admin/providers?${qs.toString()}`);
  }

  async function approve(p: Provider) {
    try {
      await api.adminApproveProvider(p.id);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function suspend(p: Provider) {
    const reason = prompt("Reason for suspension?", "");
    if (reason === null) return;
    try {
      await api.adminSuspendProvider(p.id, reason);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              status === s
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-slate-500">Loading…</p>}
      {items && items.length === 0 && <p className="text-slate-500">No providers.</p>}

      <ul className="space-y-2">
        {items?.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{p.display_name}</h3>
                <Badge status={p.approval_status} />
              </div>
              <p className="text-sm text-slate-500">
                {p.category} · {p.neighborhood || p.city} · ★ {p.average_rating.toFixed(1)} (
                {p.review_count})
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              {p.approval_status !== "approved" && (
                <button
                  onClick={() => approve(p)}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 font-medium text-white hover:bg-emerald-600"
                >
                  Approve
                </button>
              )}
              {p.approval_status !== "suspended" && (
                <button
                  onClick={() => suspend(p)}
                  className="rounded-md border border-red-300 px-3 py-1.5 font-medium text-red-600 hover:bg-red-50"
                >
                  Suspend
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Badge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    suspended: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${styles[status]}`}>{status}</span>
  );
}
