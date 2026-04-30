"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, formatPrice, getStoredUser, type Service } from "@/lib/api";

const EMPTY = {
  name: "",
  description: "",
  duration_minutes: 30,
  price_cents: 2500,
  currency: "EUR",
  active: true,
  deposit_required: false,
  deposit_amount_cents: 0,
};

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    if (!u || u.role !== "provider") {
      router.push("/login?next=/provider/services");
      return;
    }
    api.myServices().then(setServices).catch((e) => setError(String(e.message || e)));
  }, [router]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await api.createService(draft);
      setServices((prev) => [...prev, created]);
      setDraft({ ...EMPTY });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this service?")) return;
    try {
      await api.deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Services</h1>

      <ul className="space-y-2">
        {services.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
          >
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-slate-500">
                {s.duration_minutes} min · {formatPrice(s.price_cents, s.currency)}
                {s.deposit_required && s.deposit_amount_cents > 0 && (
                  <>
                    {" · "}
                    <span className="text-amber-700">
                      {formatPrice(s.deposit_amount_cents, s.currency)} deposit
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => remove(s.id)}
              className="text-sm text-red-600 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
        {services.length === 0 && <p className="text-slate-500">No services yet.</p>}
      </ul>

      <form onSubmit={add} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Add a service</h2>
        <input
          required
          placeholder="Name (e.g. Men's haircut)"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full rounded-md border border-slate-300 p-2"
        />
        <textarea
          rows={2}
          placeholder="Description (optional)"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="w-full rounded-md border border-slate-300 p-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Duration (min)
            <input
              type="number"
              min={5}
              step={5}
              required
              value={draft.duration_minutes}
              onChange={(e) =>
                setDraft({ ...draft, duration_minutes: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
            />
          </label>
          <label className="block text-sm">
            Price (EUR)
            <input
              type="number"
              min={0}
              step="0.5"
              required
              value={(draft.price_cents / 100).toString()}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  price_cents: Math.round(Number(e.target.value) * 100),
                })
              }
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
            />
          </label>
        </div>
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.deposit_required}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deposit_required: e.target.checked,
                  deposit_amount_cents: e.target.checked ? draft.deposit_amount_cents || 500 : 0,
                })
              }
            />
            Require deposit to confirm booking
          </label>
          {draft.deposit_required && (
            <label className="block text-sm">
              Deposit amount (EUR)
              <input
                type="number"
                min={1}
                step="0.5"
                value={(draft.deposit_amount_cents / 100).toString()}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    deposit_amount_cents: Math.round(Number(e.target.value) * 100),
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
              />
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-emerald-600"
        >
          Add service
        </button>
      </form>
    </div>
  );
}
