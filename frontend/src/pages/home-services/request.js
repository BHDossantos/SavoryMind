// Guided request form: customer describes the job, picks urgency/booking type,
// and submits. Quote requests fan out to providers; instant bookings target one.
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { api } from "../../services/api";

const CATEGORIES = [
  { value: "cleaning", label: "🧽 Cleaning" },
  { value: "handyman", label: "🛠️ Handyman" },
  { value: "plumbing", label: "🚰 Plumbing" },
  { value: "furniture_assembly", label: "🪑 Furniture assembly" },
  { value: "moving", label: "📦 Moving help" },
  { value: "painting", label: "🎨 Painting" },
  { value: "appliance_repair", label: "🔧 Appliance repair" },
  { value: "locksmith", label: "🔑 Locksmith" },
  { value: "gardening", label: "🌿 Gardening" },
  { value: "electrical", label: "💡 Electrical" },
  { value: "hvac", label: "❄️ AC / Heating" },
  { value: "pest_control", label: "🐜 Pest control" },
  { value: "it_support", label: "💻 IT / Internet" },
];

const URGENCY = [
  { value: "flexible", label: "Flexible — pick a date" },
  { value: "today", label: "Today if possible" },
  { value: "urgent", label: "Urgent (within 24h)" },
  { value: "emergency", label: "Emergency now" },
];

export default function RequestService() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: "cleaning",
    title: "",
    description: "",
    address_line: "",
    city: "",
    postal_code: "",
    country: "",
    property_type: "apartment",
    booking_type: "quote_request",
    urgency: "flexible",
    preferred_start: "",
    budget_min: "",
    budget_max: "",
    preferred_language: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (router.query.category) {
      setForm((f) => ({ ...f, category: router.query.category }));
    }
  }, [router.query.category]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        preferred_start: form.preferred_start || null,
      };
      // booking_type follows urgency for emergency requests.
      if (form.urgency === "emergency") payload.booking_type = "emergency";

      const job = await api.createHomeJob(payload);
      router.push(`/home-services/jobs/${job.id}`);
    } catch (err) {
      setError(err.message || "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/home-services" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="font-bold">AvailableNow Home</span>
          </Link>
          <Link href="/home-services/jobs" className="text-sm text-gray-600 hover:text-gray-900">
            My jobs
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">Tell us what you need</h1>
        <p className="mt-2 text-gray-600">
          The clearer the description, the faster a verified pro can help you.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white rounded-xl border border-gray-200 p-6">
          <Field label="Service">
            <select className="input" value={form.category} onChange={update("category")} required>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Short title">
            <input
              className="input"
              placeholder="e.g. Leaking kitchen sink"
              value={form.title}
              onChange={update("title")}
              minLength={3}
              maxLength={200}
              required
            />
          </Field>

          <Field label="Describe the job">
            <textarea
              className="input min-h-[120px]"
              placeholder="What's the issue, what room, anything we should know?"
              value={form.description}
              onChange={update("description")}
              maxLength={4000}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Booking type">
              <select className="input" value={form.booking_type} onChange={update("booking_type")}>
                <option value="quote_request">Get quotes from pros</option>
                <option value="instant">Book a fixed-price service</option>
                <option value="recurring">Recurring service</option>
              </select>
            </Field>
            <Field label="Urgency">
              <select className="input" value={form.urgency} onChange={update("urgency")}>
                {URGENCY.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Address">
              <input
                className="input"
                placeholder="Street address"
                value={form.address_line}
                onChange={update("address_line")}
              />
            </Field>
            <Field label="City">
              <input className="input" value={form.city} onChange={update("city")} />
            </Field>
            <Field label="Postal code">
              <input className="input" value={form.postal_code} onChange={update("postal_code")} />
            </Field>
            <Field label="Country">
              <input className="input" value={form.country} onChange={update("country")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Property type">
              <select className="input" value={form.property_type} onChange={update("property_type")}>
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="office">Office</option>
                <option value="airbnb">Airbnb</option>
              </select>
            </Field>
            <Field label="Preferred start (optional)">
              <input
                className="input"
                type="datetime-local"
                value={form.preferred_start}
                onChange={update("preferred_start")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Budget min (€)">
              <input className="input" type="number" min="0" value={form.budget_min} onChange={update("budget_min")} />
            </Field>
            <Field label="Budget max (€)">
              <input className="input" type="number" min="0" value={form.budget_max} onChange={update("budget_max")} />
            </Field>
            <Field label="Preferred language">
              <input className="input" placeholder="en, it, ..." value={form.preferred_language} onChange={update("preferred_language")} />
            </Field>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/home-services" className="px-5 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Send request"}
            </button>
          </div>
        </form>
      </main>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 0.55rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          background: white;
          font-size: 0.95rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #111827;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
