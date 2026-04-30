"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  formatPrice,
  formatSlot,
  getStoredUser,
  type Appointment,
  type Provider,
} from "@/lib/api";

export default function ProviderDashboardPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.push("/login?next=/provider");
      return;
    }
    if (user.role !== "provider") {
      router.push("/");
      return;
    }
    api
      .getMyProvider()
      .then((p) => {
        setProvider(p);
        return api.providerAppointments();
      })
      .then(setAppointments)
      .catch((e) => {
        if (String(e.message).includes("not found")) {
          setNeedsProfile(true);
        } else {
          setError(String(e.message || e));
        }
      });
  }, [router]);

  if (needsProfile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Welcome to Slotly</h1>
        <p>Let's set up your provider profile to start receiving bookings.</p>
        <Link
          href="/provider/profile"
          className="inline-block rounded-md bg-accent px-5 py-2.5 font-semibold text-white hover:bg-emerald-600"
        >
          Set up my profile
        </Link>
      </div>
    );
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!provider) return <p className="text-slate-500">Loading…</p>;

  const upcoming = appointments.filter(
    (a) => a.status === "confirmed" && new Date(a.start_at) >= new Date()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{provider.display_name}</h1>
          <p className="text-slate-600">
            {provider.neighborhood} · {provider.category}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/provider/profile" className="rounded-md border px-3 py-1.5">
            Edit profile
          </Link>
          <Link href="/provider/services" className="rounded-md border px-3 py-1.5">
            Services
          </Link>
          <Link href="/provider/availability" className="rounded-md border px-3 py-1.5">
            Availability
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Total bookings" value={appointments.length} />
        <Stat
          label="Cancelled"
          value={
            appointments.filter((a) => a.status.startsWith("cancelled")).length
          }
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Upcoming appointments</h2>
        {upcoming.length === 0 && (
          <p className="text-slate-500">Nothing booked yet.</p>
        )}
        <ul className="space-y-2">
          {upcoming.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <p className="font-medium">{a.service_name}</p>
              <p className="text-sm text-slate-500">
                {formatSlot(a.start_at)} · {formatPrice(a.total_price_cents)}
              </p>
              {a.customer_notes && (
                <p className="mt-1 text-sm">Notes: {a.customer_notes}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
