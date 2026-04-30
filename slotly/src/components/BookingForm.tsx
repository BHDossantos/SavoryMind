"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const categories = [
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar / aperitivo" },
  { value: "nightlife", label: "Nightlife" },
  { value: "salon", label: "Salon / barber" },
  { value: "fitness", label: "Fitness / class" },
  { value: "custom", label: "Custom" },
];

interface ParsedFields {
  category: string | null;
  neighborhood: string | null;
  date: string | null;
  time: string | null;
  partySize: number | null;
  budgetMax: number | null;
  vibe: string | null;
  specialRequests: string | null;
}

const aiAvailable = process.env.NEXT_PUBLIC_AI_PARSE === "1";

export function BookingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const initialCategory = params.get("category") ?? "restaurant";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  function setField(name: string, value: string | null) {
    if (value == null || value === "") return;
    const el = formRef.current?.elements.namedItem(name);
    if (el && !(el instanceof RadioNodeList) && "value" in el) {
      (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = value;
    }
  }

  async function onParse() {
    const text = textRef.current?.value?.trim();
    if (!text) return;
    setParsing(true);
    setError(null);
    setParseNote(null);
    const res = await fetch("/api/parse-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setParsing(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Couldn't parse");
      return;
    }
    const p: ParsedFields = await res.json();
    const filled: string[] = [];
    if (p.category) {
      setField("category", p.category);
      filled.push("category");
    }
    if (p.neighborhood) {
      setField("neighborhood", p.neighborhood);
      filled.push("neighborhood");
    }
    if (p.date) {
      setField("date", p.date);
      filled.push("date");
    }
    if (p.time) {
      setField("time", p.time);
      filled.push("time");
    }
    if (p.partySize != null) {
      setField("partySize", String(p.partySize));
      filled.push("party size");
    }
    if (p.budgetMax != null) {
      setField("budgetMax", String(p.budgetMax));
      filled.push("budget");
    }
    if (p.vibe) {
      setField("vibe", p.vibe);
      filled.push("vibe");
    }
    if (p.specialRequests) {
      setField("specialRequests", p.specialRequests);
      filled.push("special requests");
    }
    setParseNote(
      filled.length > 0
        ? `Filled: ${filled.join(", ")}. Review and adjust below.`
        : "Couldn't pull structured fields — try filling the form directly.",
    );
  }

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
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-5">
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
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0">Tell us what you want (optional)</label>
          {aiAvailable && (
            <button
              type="button"
              onClick={onParse}
              disabled={parsing}
              className="text-sm text-accent underline disabled:opacity-50"
            >
              {parsing ? "Parsing…" : "Parse with AI"}
            </button>
          )}
        </div>
        <textarea
          ref={textRef}
          className="input min-h-[88px]"
          name="rawText"
          placeholder="e.g. Romantic dinner for 2 near Trastevere tonight around 9 PM, budget €100/pp, not touristy."
        />
        {parseNote && <p className="mt-1 text-xs text-ink/60">{parseNote}</p>}
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
          By submitting, you authorize Slotly to contact businesses on your behalf.
        </p>
        <button className="btn-accent" disabled={loading}>
          {loading ? "Submitting…" : "Handle it"}
        </button>
      </div>
    </form>
  );
}
