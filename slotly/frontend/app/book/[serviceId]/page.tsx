"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, formatPrice, getStoredUser, type Service, type Slot } from "@/lib/api";

export default function BookPage() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = Number(params.serviceId);
  const router = useRouter();

  const [service, setService] = useState<Service | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setService(null);
    setSlots([]);
    setSelected(null);
    setError(null);
    api.getService(serviceId).then(async (service) => {
      const slots = await api.getProviderSlots(service.provider_id, service.id, 7);
      if (active) {
        setService(service);
        setSlots(slots);
      }
    }).catch((e) => { if (active) setError(String(e.message || e)); });
    return () => { active = false; };
  }, [serviceId]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const s of slots) {
      const day = new Date(s.start_at).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      groups[day] = groups[day] || [];
      groups[day].push(s);
    }
    return groups;
  }, [slots]);

  async function submit() {
    setError(null);
    if (!selected) {
      setError("Pick a time first.");
      return;
    }
    const user = getStoredUser();
    if (!user) {
      router.push(`/login?next=/book/${serviceId}`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.book({
        service_id: serviceId,
        start_at: selected,
        customer_notes: notes,
      });
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      router.push("/appointments?booked=1");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !service) return <p className="text-red-600">{error}</p>;
  if (!service) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{service.name}</h1>
        <p className="text-slate-600">
          {service.duration_minutes} min · {formatPrice(service.price_cents, service.currency)}
        </p>
        {service.deposit_required && service.deposit_amount_cents > 0 && (
          <p className="mt-2 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
            {formatPrice(service.deposit_amount_cents, service.currency)} deposit required to
            confirm. Refundable if you cancel more than 2h before.
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Pick a time</h2>
        {slots.length === 0 && <p className="text-slate-500">No open slots in the next 7 days.</p>}
        <div className="space-y-4">
          {Object.entries(groupedSlots).map(([day, daySlots]) => (
            <div key={day}>
              <p className="mb-1 text-sm font-medium text-slate-500">{day}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => {
                  const t = new Date(s.start_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isSelected = selected === s.start_at;
                  return (
                    <button
                      key={s.start_at}
                      onClick={() => setSelected(s.start_at)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        isSelected
                          ? "border-accent bg-accent text-white"
                          : "border-slate-300 bg-white hover:border-slate-500"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <label className="block text-sm font-medium text-slate-700">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 p-2"
          placeholder="Anything the provider should know"
        />
      </section>

      {error && <p className="text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting || !selected}
        className="rounded-md bg-accent px-6 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {submitting ? "Booking…" : "Confirm booking"}
      </button>
    </div>
  );
}
