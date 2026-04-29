"use client";

import { useEffect, useState } from "react";
import { api, formatPrice, formatSlot, type Appointment } from "@/lib/api";

const STATUSES = [
  "all",
  "confirmed",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_provider",
  "no_show",
];

export default function AdminBookingsPage() {
  const [status, setStatus] = useState<string>("all");
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    api
      .adminBookings(status === "all" ? undefined : status)
      .then(setItems)
      .catch((e) => setError(String(e.message || e)));
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              status === s
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-slate-500">Loading…</p>}

      {items && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>#</Th>
                <Th>When</Th>
                <Th>Provider</Th>
                <Th>Service</Th>
                <Th>Price</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id}>
                  <Td>{a.id}</Td>
                  <Td>{formatSlot(a.start_at)}</Td>
                  <Td>{a.provider_display_name}</Td>
                  <Td>{a.service_name}</Td>
                  <Td>{formatPrice(a.total_price_cents)}</Td>
                  <Td>{a.status}</Td>
                  <Td>
                    {a.deposit_amount_cents > 0
                      ? `${a.payment_status} (${formatPrice(a.deposit_amount_cents)})`
                      : "—"}
                  </Td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No bookings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
