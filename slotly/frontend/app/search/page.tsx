"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, formatPrice, formatSlot, type ProviderSearchResult } from "@/lib/api";

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const category = params.get("category") || "barber";
  const availableNow = params.get("available_now") === "1";
  const city = params.get("city") || "Rome";

  const [results, setResults] = useState<ProviderSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .searchProviders({ category, city, available_now: availableNow })
      .then(setResults)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [category, city, availableNow]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/search?${next.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {category === "barber" ? "Barbers" : category} in {city}
        </h1>
        <p className="text-slate-600">
          {results.length} provider{results.length === 1 ? "" : "s"} found
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("available_now", availableNow ? "" : "1")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
            availableNow
              ? "border-accent bg-accent text-white"
              : "border-slate-300 bg-white hover:border-slate-400"
          }`}
        >
          Available now
        </button>
        {["barber", "hair_salon", "nails", "massage"].map((c) => (
          <button
            key={c}
            onClick={() => setFilter("category", c)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              category === c
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            {c.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && results.length === 0 && (
        <p className="text-slate-500">No providers match your filters.</p>
      )}

      <ul className="space-y-3">
        {results.map((p) => (
          <li key={p.id}>
            <Link
              href={`/providers/${p.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-ink"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.display_name}</h3>
                  {p.is_verified && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {p.neighborhood} · ★ {p.average_rating.toFixed(1)} ({p.review_count})
                </p>
                <p className="mt-1 text-sm">
                  Next: <span className="font-medium">{formatSlot(p.next_slot)}</span>
                  {" · "}from {formatPrice(p.min_price_cents)}
                </p>
              </div>
              <span className="text-sm font-medium text-accent">Book →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
