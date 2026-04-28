'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { capture } from '@/lib/analytics';
import type { Plan } from '../../../../shared/types';

const REQUEST_TYPES = [
  { value: 'dinner', label: 'Dinner reservation' },
  { value: 'bar_table', label: 'Bar table' },
  { value: 'guestlist', label: 'Guest list' },
  { value: 'vip_table', label: 'VIP table' },
  { value: 'special', label: 'Special event' },
] as const;

const DEFAULT_TYPE: Record<string, string> = {
  restaurant: 'dinner', late_food: 'dinner',
  bar: 'bar_table', lounge: 'bar_table', speakeasy: 'bar_table',
  rooftop: 'bar_table', live_music: 'bar_table',
  club: 'guestlist',
};

interface PerStopState {
  venue_id: number;
  skip: boolean;
  request_type: string;
  time: string;
  notes: string;
  vip_interest: 'yes' | 'no';
}

export default function PlanBookingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const planId = Number(params.get('plan_id'));

  const [plan, setPlan] = useState<Plan | null>(null);
  const [stops, setStops] = useState<PerStopState[]>([]);
  const [shared, setShared] = useState({
    contact_name: '', contact_phone: '', contact_email: '',
    group_size: 2, notes: '', bottle_preference: '', arrival_time: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    api.get<Plan>(`/api/plans/${planId}`).then(p => {
      setPlan(p);
      setShared(s => ({ ...s, group_size: p.group_size }));
      setStops(p.stops.map(s => ({
        venue_id: s.venue_id,
        skip: false,
        request_type: DEFAULT_TYPE[(s.venue?.type as string) || s.type] || 'dinner',
        time: (s.slot_start || '').slice(11, 16),
        notes: '',
        vip_interest: 'no',
      })));
    }).catch(e => setErr(e?.message || 'Plan not found'));
  }, [planId]);

  const setStop = (i: number, patch: Partial<PerStopState>) =>
    setStops(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const skippedAll = useMemo(() => stops.length > 0 && stops.every(s => s.skip), [stops]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const overrides = stops
        .filter((s, i) => s.skip
          || s.request_type !== (DEFAULT_TYPE[(plan?.stops[i].venue?.type as string) || plan?.stops[i].type || ''] || 'dinner')
          || s.time !== (plan?.stops[i].slot_start || '').slice(11, 16)
          || s.notes
          || s.vip_interest === 'yes')
        .map(s => ({ ...s }));
      const r = await api.post<{ plan_id: number; bookings: any[] }>(
        `/api/bookings/plan/${planId}`,
        { ...shared, overrides },
      );
      capture('plan_booked', {
        plan_id: r.plan_id,
        stops_booked: r.bookings.length,
        stops_total: stops.length,
        any_vip: stops.some(s => s.vip_interest === 'yes'),
      });
      router.push(`/plan/${r.plan_id}/bookings`);
    } catch (e: any) {
      setErr(e?.message || 'Could not submit');
    } finally { setBusy(false); }
  }

  if (!planId) return <p className="text-accent-500">Missing plan_id.</p>;
  if (err && !plan) return <p className="text-accent-500">{err}</p>;
  if (!plan) return <p className="text-gold-400/60">Loading plan…</p>;

  return (
    <form onSubmit={submit} className="max-w-3xl mx-auto space-y-6">
      <header>
        <p className="label">Book your night</p>
        <h1 className="font-display text-3xl mt-1">{plan.label}</h1>
        <p className="text-gold-400/60 text-sm mt-1">
          One submission books all {plan.stops.length} stops. We'll confirm each within 30 min via WhatsApp / email.
        </p>
      </header>

      <section className="card space-y-3">
        <h2 className="label">Your contact</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" required value={shared.contact_name} onChange={(v) => setShared({ ...shared, contact_name: v })} />
          <Input label="Phone" required value={shared.contact_phone} onChange={(v) => setShared({ ...shared, contact_phone: v })} />
          <Input label="Email" type="email" required value={shared.contact_email} onChange={(v) => setShared({ ...shared, contact_email: v })} />
          <Input label="Group size" type="number" required value={String(shared.group_size)} onChange={(v) => setShared({ ...shared, group_size: Number(v) || 2 })} />
        </div>
        <textarea
          rows={2}
          placeholder="Anything we should tell every venue? (anniversary, dietary, etc.)"
          value={shared.notes} onChange={(e) => setShared({ ...shared, notes: e.target.value })}
          className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2"
        />
      </section>

      <section className="space-y-3">
        <h2 className="label">Stops in this plan</h2>
        {plan.stops.map((s, i) => {
          const st = stops[i];
          if (!st) return null;
          return (
            <div key={s.venue_id} className={`card transition ${st.skip ? 'opacity-40' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gold-400/60 uppercase tracking-wider">
                    {new Date(s.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.slot_role}
                  </p>
                  <Link href={`/venues/${s.slug}`} className="font-display text-xl text-gold-400 hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-gold-400/60">{s.summary}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!st.skip} onChange={(e) => setStop(i, { skip: !e.target.checked })} />
                  Include
                </label>
              </div>
              {!st.skip && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Select label="Request type" value={st.request_type} onChange={(v) => setStop(i, { request_type: v })}
                    options={REQUEST_TYPES.map(r => ({ value: r.value, label: r.label }))} />
                  <Input label="Time" type="time" value={st.time} onChange={(v) => setStop(i, { time: v })} />
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={st.vip_interest === 'yes'}
                      onChange={(e) => setStop(i, { vip_interest: e.target.checked ? 'yes' : 'no' })} />
                    Interested in VIP table here
                  </label>
                  <textarea
                    placeholder="Notes for this venue (optional)"
                    rows={2} value={st.notes} onChange={(e) => setStop(i, { notes: e.target.value })}
                    className="col-span-2 bg-night-900 border border-white/10 rounded-lg px-3 py-2"
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {err && <p className="text-accent-500 text-sm">{err}</p>}
      <button disabled={busy || skippedAll} className="btn btn-primary w-full disabled:opacity-30">
        {busy ? 'Sending…' : `Submit ${stops.filter(s => !s.skip).length} booking request(s)`}
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
