"use client";

import { useState } from "react";
import { BUSINESS_TYPE_LABELS } from "@/lib/multiples";
import type { BusinessType, DealInput } from "@/lib/types";

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[];

export const blankDeal: DealInput = {
  name: "",
  businessType: "restaurant",
  location: "",
  notes: "",
  revenue: 0,
  rent: 0,
  laborCost: 0,
  cogs: 0,
  utilities: 0,
  otherExpenses: 0,
  ownerSalary: 0,
  askingPrice: 0,
  locationQuality: 6,
  growthPotential: 5,
  ownerDependency: 5,
  seasonality: 4,
};

interface Props {
  initial?: DealInput;
  submitLabel?: string;
  onSubmit: (input: DealInput) => void;
  onCancel?: () => void;
}

export default function DealForm({
  initial,
  submitLabel = "Analyze deal",
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<DealInput>(initial ?? blankDeal);

  function set<K extends keyof DealInput>(key: K, value: DealInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function num(key: keyof DealInput) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, Number(e.target.value || 0) as DealInput[typeof key]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold mb-3">Business</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Lina's Trattoria"
              required
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="select"
              value={form.businessType}
              onChange={(e) =>
                set("businessType", e.target.value as BusinessType)
              }
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BUSINESS_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Lisbon, PT"
            />
          </div>
          <div>
            <label className="label">Asking price (€)</label>
            <input
              type="number"
              className="input"
              value={form.askingPrice || ""}
              onChange={num("askingPrice")}
              placeholder="320000"
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Annual financials (€)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Revenue" value={form.revenue} onChange={num("revenue")} />
          <Field label="Rent" value={form.rent} onChange={num("rent")} />
          <Field
            label="Labor cost"
            value={form.laborCost}
            onChange={num("laborCost")}
          />
          <Field label="COGS" value={form.cogs} onChange={num("cogs")} />
          <Field
            label="Utilities"
            value={form.utilities}
            onChange={num("utilities")}
          />
          <Field
            label="Other expenses"
            value={form.otherExpenses}
            onChange={num("otherExpenses")}
          />
          <Field
            label="Owner salary add-back"
            value={form.ownerSalary || 0}
            onChange={num("ownerSalary")}
            hint="If owner-operator, add back their salary for EBITDA"
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Qualitative (0–10)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RangeField
            label="Location quality"
            value={form.locationQuality ?? 5}
            onChange={(v) => set("locationQuality", v)}
          />
          <RangeField
            label="Growth potential"
            value={form.growthPotential ?? 5}
            onChange={(v) => set("growthPotential", v)}
          />
          <RangeField
            label="Owner dependency"
            value={form.ownerDependency ?? 5}
            onChange={(v) => set("ownerDependency", v)}
          />
          <RangeField
            label="Seasonality"
            value={form.seasonality ?? 5}
            onChange={(v) => set("seasonality", v)}
          />
        </div>
      </section>

      <section className="card p-5">
        <label className="label">Notes</label>
        <textarea
          className="textarea"
          rows={3}
          value={form.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anything you've learned about the deal..."
        />
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={value || ""}
        onChange={onChange}
        placeholder="0"
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        <span className="text-xs font-mono text-slate-700">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
    </div>
  );
}
