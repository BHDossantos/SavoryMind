"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatPrice, type AdminDashboard } from "@/lib/api";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminDashboard().then(setData).catch((e) => setError(String(e.message || e)));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Customers" value={data.users.customers} />
        <Stat label="Providers" value={data.providers.total} />
        <Stat
          label="Pending approval"
          value={data.providers.pending}
          highlight={data.providers.pending > 0}
          href="/admin/providers?status=pending"
        />
        <Stat label="Suspended" value={data.providers.suspended} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bookings today" value={data.bookings.today} />
        <Stat label="Bookings (7d)" value={data.bookings.last_7_days} />
        <Stat label="Cancellations (7d)" value={data.bookings.cancellations_last_7_days} />
        <Stat
          label="GBV"
          value={formatPrice(data.gross_booking_value_cents)}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Stat label="Deposits held" value={formatPrice(data.deposits_held_cents)} />
      </section>

      {data.providers.pending > 0 && (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-amber-800">
          {data.providers.pending} provider{data.providers.pending === 1 ? "" : "s"} waiting for
          approval. <Link href="/admin/providers?status=pending" className="underline">Review now →</Link>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  href,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
