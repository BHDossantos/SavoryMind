"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const categories = [
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar / aperitivo" },
  { value: "nightlife", label: "Nightlife" },
  { value: "salon", label: "Salon / barber" },
  { value: "fitness", label: "Fitness / class" },
  { value: "custom", label: "Custom" },
];

export function BookingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const initialCategory = params.get("category") ?? "restaurant";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string" && v.length > 0) payload[k] = v;
    });
    const res = await fetch("/api/booking-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Couldn't submit");
      setLoading(false);
      return;
    }
    const data = await res.json();
    router.push(`/bookings/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      <div>
        <label className="label">Category</label>
        <select className="input" name="category" defaultValue={initialCategory} required>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Tell us what you want (optional)</label>
        <textarea
          className="input min-h-[88px]"
          name="rawText"
          placeholder="e.g. Romantic dinner for 2 near Trastevere tonight around 9 PM, budget €100/pp, not touristy."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" name="date" />
        </div>
        <div>
          <label className="label">Time</label>
          <input className="input" type="time" name="time" />
        </div>
        <div>
          <label className="label">Party size</label>
          <input className="input" type="number" name="partySize" min={1} max={50} defaultValue={2} required />
        </div>
        <div>
          <label className="label">Neighborhood</label>
          <input className="input" name="neighborhood" placeholder="Trastevere" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="label">Budget min (€)</label>
          <input className="input" type="number" name="budgetMin" min={0} />
        </div>
        <div>
          <label className="label">Budget max (€)</label>
          <input className="input" type="number" name="budgetMax" min={0} />
        </div>
        <div>
          <label className="label">Vibe</label>
          <input className="input" name="vibe" placeholder="romantic, lively, chic…" />
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" name="priority" defaultValue="normal">
            <option value="normal">Normal — free</option>
            <option value="priority">Priority — €4.99</option>
            <option value="vip">VIP concierge</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Special requests</label>
        <textarea
          className="input"
          name="specialRequests"
          placeholder="Birthday, dietary, outdoor seating, accessibility…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name for the booking</label>
          <input className="input" name="contactName" required />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" name="contactPhone" type="tel" required />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink/50">
          By submitting, you authorize AutoBook AI to contact businesses on your behalf.
        </p>
        <button className="btn-accent" disabled={loading}>
          {loading ? "Submitting…" : "Handle it"}
        </button>
      </div>
    </form>
  );
}
