"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getStoredUser, type AvailabilityWindow } from "@/lib/api";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Row {
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT: Row = { enabled: false, start: "09:00", end: "18:00" };

export default function AvailabilityPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(Array.from({ length: 7 }, () => ({ ...DEFAULT })));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    if (!u || u.role !== "provider") {
      router.push("/login?next=/provider/availability");
      return;
    }
    api
      .myAvailability()
      .then((existing) => {
        const next = Array.from({ length: 7 }, () => ({ ...DEFAULT }));
        for (const w of existing) {
          next[w.day_of_week] = {
            enabled: true,
            start: w.start_time.slice(0, 5),
            end: w.end_time.slice(0, 5),
          };
        }
        setRows(next);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoaded(true));
  }, [router]);

  function update(day: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === day ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: AvailabilityWindow[] = rows
        .map((r, i) =>
          r.enabled
            ? { day_of_week: i, start_time: `${r.start}:00`, end_time: `${r.end}:00` }
            : null
        )
        .filter((x): x is AvailabilityWindow => x !== null);
      await api.replaceMyAvailability(payload);
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Weekly availability</h1>
      <p className="text-sm text-slate-600">Set the hours you're open each day. Customers can only book within these windows.</p>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
          >
            <label className="flex w-20 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
              />
              <span>{DAYS[i]}</span>
            </label>
            <input
              type="time"
              disabled={!row.enabled}
              value={row.start}
              onChange={(e) => update(i, { start: e.target.value })}
              className="rounded-md border border-slate-300 p-1.5 text-sm disabled:bg-slate-100"
            />
            <span className="text-slate-400">to</span>
            <input
              type="time"
              disabled={!row.enabled}
              value={row.end}
              onChange={(e) => update(i, { end: e.target.value })}
              className="rounded-md border border-slate-300 p-1.5 text-sm disabled:bg-slate-100"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && <p className="text-sm text-emerald-600">Saved.</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-accent px-5 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
