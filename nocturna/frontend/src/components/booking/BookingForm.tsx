'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { REQUEST_TYPES } from '../../../../shared/constants/options';

export default function BookingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const venueId = Number(params.get('venue_id'));
  const planId = params.get('plan_id') ? Number(params.get('plan_id')) : null;

  const [form, setForm] = useState({
    contact_name: '', contact_phone: '', contact_email: '',
    date: '', time: '21:30', group_size: 2,
    request_type: params.get('request_type') || 'dinner',
    budget_eur: 0,
    bottle_preference: '',
    arrival_time: '',
    notes: '',
    vip_interest: 'no' as 'yes' | 'no',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      const r = await api.post<{ id: number }>('/api/bookings', {
        venue_id: venueId,
        plan_id: planId,
        ...form,
        budget_eur: form.budget_eur || null,
      });
      router.push(`/bookings/${r.id}`);
    } catch (e: any) {
      setError(e?.message || 'Could not submit');
    } finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-3xl">Request your booking</h1>
      <p className="text-gold-400/60 text-sm">Our concierge confirms within 30 minutes via WhatsApp or email.</p>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Your name" value={form.contact_name} onChange={(v) => set('contact_name', v)} required />
        <Input label="Phone" value={form.contact_phone} onChange={(v) => set('contact_phone', v)} required />
        <Input label="Email" type="email" value={form.contact_email} onChange={(v) => set('contact_email', v)} required />
        <Input label="Group size" type="number" value={String(form.group_size)} onChange={(v) => set('group_size', Number(v))} required />
        <Input label="Date" type="date" value={form.date} onChange={(v) => set('date', v)} required />
        <Input label="Time" type="time" value={form.time} onChange={(v) => set('time', v)} required />
      </div>

      <Select label="Request type" value={form.request_type}
        options={REQUEST_TYPES.map(r => ({ value: r.value, label: r.label }))}
        onChange={(v) => set('request_type', v)} />

      {(form.request_type === 'vip_table' || form.vip_interest === 'yes') && (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Budget (€)" type="number" value={String(form.budget_eur)} onChange={(v) => set('budget_eur', Number(v))} />
          <Input label="Bottle preference" value={form.bottle_preference} onChange={(v) => set('bottle_preference', v)} />
          <Input label="Arrival time" value={form.arrival_time} onChange={(v) => set('arrival_time', v)} />
          <Select label="VIP interest" value={form.vip_interest}
            options={[{ value: 'yes', label: 'Yes — VIP table' }, { value: 'no', label: 'No' }]}
            onChange={(v) => set('vip_interest', v as any)} />
        </div>
      )}

      <label className="block">
        <span className="label">Special requests</span>
        <textarea className="w-full mt-1 bg-night-900 border border-white/10 rounded-lg px-3 py-2"
          rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {error && <p className="text-accent-500 text-sm">{error}</p>}
      <button disabled={submitting} className="btn btn-primary w-full">
        {submitting ? 'Sending…' : 'Send booking request'}
      </button>
    </form>
  );
}

function Input({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
    </label>
  );
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-night-900 border border-white/10 rounded-lg px-3 py-2">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
