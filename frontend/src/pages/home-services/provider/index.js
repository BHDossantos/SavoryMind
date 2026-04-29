// Provider hub: shows the provider's profile (or onboards them), open job feed,
// services they offer, and a link to their bookings.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../services/api";

const CATEGORY_OPTIONS = [
  "cleaning",
  "handyman",
  "plumbing",
  "furniture_assembly",
  "moving",
  "painting",
  "appliance_repair",
  "locksmith",
  "gardening",
  "electrical",
  "hvac",
  "pest_control",
  "it_support",
];

export default function ProviderHub() {
  const [provider, setProvider] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAll() {
    try {
      const me = await api.getMyHomeProvider();
      setProvider(me || null);
      if (me) {
        const [j, s, b] = await Promise.all([
          api.listProviderJobFeed().catch(() => []),
          api.listMyHomeServices().catch(() => []),
          api.listProviderHomeBookings().catch(() => []),
        ]);
        setJobs(j || []);
        setServices(s || []);
        setBookings(b || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <div className="p-10 text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/home-services" className="font-bold">
            🏠 AvailableNow Home
          </Link>
          <span className="text-sm text-gray-500">Pro dashboard</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {!provider ? (
          <ProviderOnboarding onCreated={() => loadAll()} />
        ) : (
          <>
            <ProviderHeader provider={provider} />

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Stat label="Open jobs in feed" value={jobs.length} />
              <Stat label="Active services" value={services.filter((s) => s.active).length} />
              <Stat label="Bookings" value={bookings.length} />
            </section>

            <Section title="Job feed">
              {jobs.length === 0 ? (
                <div className="text-sm text-gray-500">No matching open jobs right now.</div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((j) => (
                    <JobCard key={j.id} job={j} onQuoted={loadAll} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="My services">
              <ServicesEditor services={services} onChange={loadAll} />
            </Section>

            <Section title="Bookings">
              {bookings.length === 0 ? (
                <div className="text-sm text-gray-500">No bookings yet.</div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <BookingRow key={b.id} booking={b} onChanged={loadAll} />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function ProviderHeader({ provider }) {
  let categories = [];
  try { categories = JSON.parse(provider.categories || "[]"); } catch {}
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold">{provider.business_name || "My pro profile"}</h1>
          <div className="mt-1 text-sm text-gray-500">
            {provider.city || "no city"} · {provider.provider_type} · {provider.verified_status}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Rating</div>
          <div className="text-xl font-bold">
            {provider.average_rating ? provider.average_rating.toFixed(2) : "–"} ★
          </div>
        </div>
      </div>
      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c} className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderOnboarding({ onCreated }) {
  const [form, setForm] = useState({
    business_name: "",
    provider_type: "individual",
    bio: "",
    city: "",
    country: "",
    service_radius_km: 15,
    hourly_rate: "",
    minimum_fee: "",
    accepts_emergency: false,
    categories: [],
    languages: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.upsertHomeProvider({
        ...form,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        minimum_fee: form.minimum_fee ? Number(form.minimum_fee) : null,
        service_radius_km: Number(form.service_radius_km) || 15,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(c) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h1 className="text-2xl font-bold">Become a pro</h1>
      <p className="text-gray-600 mt-1">Set up your profile to start receiving job requests.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Business or display name"
          value={form.business_name}
          onChange={(e) => setForm({ ...form, business_name: e.target.value })}
        />
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[80px]"
          placeholder="Short bio — what you do, years of experience"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            type="number"
            placeholder="Service radius (km)"
            value={form.service_radius_km}
            onChange={(e) => setForm({ ...form, service_radius_km: e.target.value })}
          />
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            value={form.provider_type}
            onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </select>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            type="number"
            placeholder="Hourly rate (€)"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            type="number"
            placeholder="Minimum fee (€)"
            value={form.minimum_fee}
            onChange={(e) => setForm({ ...form, minimum_fee: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.accepts_emergency}
            onChange={(e) => setForm({ ...form, accepts_emergency: e.target.checked })}
          />
          Available for emergency jobs
        </label>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Categories you offer</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={`text-xs px-3 py-1 rounded-full border ${
                  form.categories.includes(c)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={busy || form.categories.length === 0}
          className="px-5 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create pro profile"}
        </button>
      </form>
    </div>
  );
}

function JobCard({ job, onQuoted }) {
  const [open, setOpen] = useState(false);
  const [labor, setLabor] = useState("");
  const [materials, setMaterials] = useState("0");
  const [travel, setTravel] = useState("0");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await api.submitHomeQuote(job.id, {
        labor_cost: Number(labor) || 0,
        materials_cost: Number(materials) || 0,
        travel_fee: Number(travel) || 0,
        estimated_duration_minutes: duration ? Number(duration) : null,
        notes: notes || null,
      });
      setOpen(false);
      onQuoted();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="font-semibold">{job.title}</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {job.category} · {job.urgency} · {job.city || "no city"}
          </div>
          {job.description && <p className="mt-2 text-sm text-gray-700">{job.description}</p>}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
        >
          {open ? "Close" : "Quote"}
        </button>
      </div>
      {open && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Labor (€)" value={labor} onChange={(e) => setLabor(e.target.value)} />
          <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Materials (€)" value={materials} onChange={(e) => setMaterials(e.target.value)} />
          <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Travel fee (€)" value={travel} onChange={(e) => setTravel(e.target.value)} />
          <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Estimated duration (min)" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <textarea className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg" placeholder="Notes for the customer" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {err && <div className="md:col-span-2 text-sm text-red-600">{err}</div>}
          <button
            onClick={send}
            disabled={busy || !labor}
            className="md:col-span-2 px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send quote"}
          </button>
        </div>
      )}
    </div>
  );
}

function ServicesEditor({ services, onChange }) {
  const [form, setForm] = useState({
    category: "cleaning",
    name: "",
    pricing_type: "hourly",
    base_price: "",
    hourly_rate: "",
    estimated_duration_minutes: "",
  });
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.addHomeService({
        ...form,
        base_price: form.base_price ? Number(form.base_price) : null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        estimated_duration_minutes: form.estimated_duration_minutes
          ? Number(form.estimated_duration_minutes)
          : null,
      });
      setForm({ ...form, name: "" });
      onChange();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm("Remove this service?")) return;
    await api.deleteHomeService(id);
    onChange();
  }

  return (
    <div>
      <form onSubmit={add} className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select className="px-3 py-2 border border-gray-300 rounded-lg" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input className="px-3 py-2 border border-gray-300 rounded-lg" placeholder="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="px-3 py-2 border border-gray-300 rounded-lg" value={form.pricing_type} onChange={(e) => setForm({ ...form, pricing_type: e.target.value })}>
          <option value="hourly">Hourly</option>
          <option value="fixed">Fixed</option>
          <option value="quote_required">Quote required</option>
          <option value="diagnostic_fee">Diagnostic fee</option>
        </select>
        <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Base price (€)" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
        <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Hourly rate (€)" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
        <input className="px-3 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Duration (min)" value={form.estimated_duration_minutes} onChange={(e) => setForm({ ...form, estimated_duration_minutes: e.target.value })} />
        <button type="submit" disabled={busy} className="md:col-span-3 px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50">
          {busy ? "Adding…" : "Add service"}
        </button>
      </form>
      {services.length > 0 && (
        <div className="mt-4 space-y-2">
          {services.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-500">
                  {s.category} · {s.pricing_type} ·{" "}
                  {s.pricing_type === "hourly" ? `€${s.hourly_rate}/h` : `€${s.base_price}`}
                </div>
              </div>
              <button onClick={() => remove(s.id)} className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PROVIDER_STATUS_TRANSITIONS = ["provider_on_way", "arrived", "in_progress", "completed"];

function BookingRow({ booking, onChanged }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status) {
    setBusy(true);
    try {
      await api.updateHomeBookingStatus(booking.id, { status });
      onChanged();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex justify-between items-center gap-4">
      <div>
        <div className="font-semibold">Booking #{booking.id}</div>
        <div className="text-sm text-gray-500">
          {booking.scheduled_start ? new Date(booking.scheduled_start).toLocaleString() : "TBD"} ·{" "}
          {booking.final_price} {booking.currency} · {booking.status}
        </div>
      </div>
      <div className="flex gap-2">
        {PROVIDER_STATUS_TRANSITIONS.filter((s) => s !== booking.status).map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => setStatus(s)}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
