"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatPrice, type Provider, type Service } from "@/lib/api";

export default function ProviderProfilePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getProvider(id), api.getProviderServices(id)])
      .then(([p, s]) => {
        setProvider(p);
        setServices(s);
      })
      .catch((e) => setError(String(e.message || e)));
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!provider) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{provider.display_name}</h1>
        <p className="text-slate-600">
          {provider.neighborhood}, {provider.city} · ★ {provider.average_rating.toFixed(1)} (
          {provider.review_count} reviews)
        </p>
        <p className="mt-2">{provider.bio}</p>
        <p className="mt-1 text-sm text-slate-500">
          {provider.address} · Languages: {provider.languages}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Services</h2>
        <ul className="space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
            >
              <div>
                <h3 className="font-medium">{s.name}</h3>
                <p className="text-sm text-slate-500">{s.duration_minutes} min</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{formatPrice(s.price_cents, s.currency)}</span>
                <Link
                  href={`/book/${s.id}`}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                >
                  Book
                </Link>
              </div>
            </li>
          ))}
          {services.length === 0 && (
            <p className="text-slate-500">No services listed yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
