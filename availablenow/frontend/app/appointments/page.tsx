"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, formatPrice, formatSlot, getStoredUser, type Appointment } from "@/lib/api";

export default function MyAppointmentsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <AppointmentsInner />
    </Suspense>
  );
}

function AppointmentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const justBooked = params.get("booked") === "1";
  const justReviewed = params.get("reviewed") === "1";

  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredUser()) {
      router.push("/login?next=/appointments");
      return;
    }
    api.myAppointments().then(setItems).catch((e) => setError(String(e.message || e)));
  }, [router]);

  async function cancel(id: number) {
    if (!confirm("Cancel this appointment?")) return;
    try {
      const updated = await api.cancelAppointment(id);
      setItems((prev) => prev?.map((a) => (a.id === id ? updated : a)) ?? null);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My appointments</h1>
      {justBooked && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-emerald-700">
          Booking confirmed. We'll send a reminder before your appointment.
        </p>
      )}
      {justReviewed && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-emerald-700">
          Thanks for the review.
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-slate-500">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-slate-500">No appointments yet. Find a slot from the home screen.</p>
      )}
      <ul className="space-y-3">
        {items?.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <h3 className="font-semibold">{a.service_name}</h3>
              <p className="text-sm text-slate-500">{a.provider_display_name}</p>
              <p className="mt-1 text-sm">
                {formatSlot(a.start_at)} · {formatPrice(a.total_price_cents)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{a.status}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {a.can_review && (
                <Link
                  href={`/appointments/${a.id}/review`}
                  className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-amber-300"
                >
                  Leave a review
                </Link>
              )}
              {a.has_review && (
                <span className="text-sm text-slate-500">★ Reviewed</span>
              )}
              {a.status === "confirmed" && new Date(a.start_at) > new Date() && (
                <button
                  onClick={() => cancel(a.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
