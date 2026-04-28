"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Candidate {
  id: number;
  business_id: number;
  business_name: string;
  match_score: number;
  reason: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  tags: string | null;
}

export function AdminRequestPanel({
  requestId,
  candidates,
  defaults,
}: {
  requestId: number;
  candidates: Candidate[];
  defaults: { date: string; time: string };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"contact" | "confirm" | "status">("contact");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown, method: "POST" | "PUT" = "POST") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/booking-requests/${requestId}/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="card space-y-4">
      <div className="flex gap-2 text-sm">
        {(["contact", "confirm", "status"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 ${tab === t ? "bg-ink text-cream" : "border border-ink/15"}`}
          >
            {t === "contact" ? "Log contact" : t === "confirm" ? "Confirm booking" : "Set status"}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "contact" && (
        <ContactForm candidates={candidates} pending={pending} onSubmit={(b) => post("contact-attempt", b)} />
      )}

      {tab === "confirm" && (
        <ConfirmForm
          candidates={candidates}
          defaults={defaults}
          pending={pending}
          onSubmit={(b) => post("confirm", b)}
        />
      )}

      {tab === "status" && <StatusForm pending={pending} onSubmit={(b) => post("status", b, "PUT")} />}
    </div>
  );
}

function ContactForm({
  candidates,
  pending,
  onSubmit,
}: {
  candidates: Candidate[];
  pending: boolean;
  onSubmit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const ok = await onSubmit({
          businessId: fd.get("businessId") || undefined,
          method: fd.get("method"),
          result: fd.get("result"),
          notes: fd.get("notes") || undefined,
        });
        if (ok) (e.currentTarget as HTMLFormElement).reset();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Business</label>
          <select className="input" name="businessId">
            <option value="">— other —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.business_id}>
                {c.business_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" name="method" defaultValue="phone">
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="in_person">In person</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Result</label>
          <select className="input" name="result" defaultValue="pending">
            <option value="no_answer">No answer</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Waiting response</option>
            <option value="alternative_offered">Alternative offered</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" name="notes" placeholder="Spoke with Marco, will hold table…" />
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Log attempt"}
      </button>
    </form>
  );
}

function ConfirmForm({
  candidates,
  defaults,
  pending,
  onSubmit,
}: {
  candidates: Candidate[];
  defaults: { date: string; time: string };
  pending: boolean;
  onSubmit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [businessId, setBusinessId] = useState<string>(candidates[0]?.business_id?.toString() ?? "");
  const selected = candidates.find((c) => c.business_id.toString() === businessId);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload: Record<string, unknown> = {};
        fd.forEach((v, k) => {
          if (typeof v === "string" && v.length > 0) payload[k] = v;
        });
        payload.needsApproval = fd.get("needsApproval") === "on";
        await onSubmit(payload);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Candidate</label>
          <select
            className="input"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            name="businessId"
          >
            <option value="">— other —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.business_id}>
                {c.business_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Business name</label>
          <input
            className="input"
            name="businessName"
            defaultValue={selected?.business_name ?? ""}
            key={selected?.business_id ?? "other"}
            required
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" name="date" defaultValue={defaults.date} required />
        </div>
        <div>
          <label className="label">Time</label>
          <input className="input" type="time" name="time" defaultValue={defaults.time} required />
        </div>
        <div>
          <label className="label">Booking name</label>
          <input className="input" name="confirmationName" />
        </div>
        <div>
          <label className="label">Confirmation code</label>
          <input className="input" name="confirmationCode" />
        </div>
        <div>
          <label className="label">Address</label>
          <input
            className="input"
            name="address"
            defaultValue={selected?.address ?? ""}
            key={`a-${selected?.business_id ?? "other"}`}
          />
        </div>
        <div>
          <label className="label">Venue phone</label>
          <input
            className="input"
            name="venueContactPhone"
            defaultValue={selected?.phone ?? ""}
            key={`p-${selected?.business_id ?? "other"}`}
          />
        </div>
      </div>
      <div>
        <label className="label">Instructions</label>
        <input className="input" name="instructions" placeholder="Outdoor seating reserved, ask for…" />
      </div>
      <div>
        <label className="label">Cancellation policy</label>
        <input className="input" name="cancellationPolicy" placeholder="Free up to 2h before" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needsApproval" />
        Different time/date than requested — needs user approval
      </label>
      <button className="btn-accent" disabled={pending}>
        {pending ? "Saving…" : "Save confirmation"}
      </button>
    </form>
  );
}

function StatusForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          status: fd.get("status"),
          notes: fd.get("notes") || undefined,
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">New status</label>
          <select className="input" name="status" defaultValue="searching">
            <option value="in_review">In review</option>
            <option value="searching">Searching</option>
            <option value="contacting">Contacting venues</option>
            <option value="needs_approval">Needs approval</option>
            <option value="failed">Failed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" name="notes" />
        </div>
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Update status"}
      </button>
    </form>
  );
}
