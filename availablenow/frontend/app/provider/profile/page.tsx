"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getStoredUser } from "@/lib/api";

const CATEGORIES = ["barber", "hair_salon", "nails", "massage", "lashes", "brows", "makeup"];

export default function ProviderProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    category: "barber",
    address: "",
    city: "Rome",
    neighborhood: "",
    languages: "it,en",
    profile_photo_url: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== "provider") {
      router.push("/login?next=/provider/profile");
      return;
    }
    api
      .getMyProvider()
      .then((p) =>
        setForm({
          display_name: p.display_name,
          bio: p.bio,
          category: p.category,
          address: p.address,
          city: p.city,
          neighborhood: p.neighborhood,
          languages: p.languages,
          profile_photo_url: p.profile_photo_url,
        })
      )
      .catch(() => {
        // first-time setup, leave defaults
      })
      .finally(() => setLoaded(true));
  }, [router]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.upsertMyProvider(form);
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Provider profile</h1>
      <form onSubmit={save} className="space-y-3">
        <Field label="Display name">
          <input
            required
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2"
          />
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bio">
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2"
            />
          </Field>
          <Field label="Neighborhood">
            <input
              value={form.neighborhood}
              onChange={(e) => update("neighborhood", e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2"
            />
          </Field>
        </div>
        <Field label="Address">
          <input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2"
          />
        </Field>
        <Field label="Languages (comma-separated)">
          <input
            value={form.languages}
            onChange={(e) => update("languages", e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedAt && <p className="text-sm text-emerald-600">Saved.</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-5 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
