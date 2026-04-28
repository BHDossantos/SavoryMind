'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface PlanBookings {
  plan_id: number;
  aggregate_status: 'none' | 'pending' | 'partial' | 'confirmed';
  bookings: any[];
}

const STATUS_TONE: Record<string, string> = {
  new: 'bg-night-700/40 text-gold-400/80 border-white/10',
  pending: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  rejected: 'bg-red-900/30 text-red-300 border-red-700/40',
  cancelled: 'bg-red-900/20 text-red-300/70 border-red-700/30',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  no_show: 'bg-red-900/30 text-red-300 border-red-700/40',
};

export default function PlanBookingsBoard({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PlanBookings | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { setData(await api.get<PlanBookings>(`/api/bookings/plan/${params.id}`)); }
    catch (e: any) { setErr(e?.message || 'Could not load bookings'); }
  }
  useEffect(() => { load(); }, [params.id]);

  if (err) return <p className="text-accent-500">{err}</p>;
  if (!data) return <p className="text-gold-400/60">Loading…</p>;
  if (!data.bookings.length) return (
    <div className="text-center py-20">
      <p className="label">No bookings yet</p>
      <h1 className="font-display text-3xl mt-2">This plan hasn't been booked.</h1>
      <Link href={`/bookings/new?plan_id=${params.id}`} className="btn btn-primary mt-6 inline-block">Book this plan</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="label">Plan #{data.plan_id} · status board</p>
          <h1 className="font-display text-4xl mt-1">Your night</h1>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full border ${STATUS_TONE[data.aggregate_status] || ''}`}>
          {data.aggregate_status}
        </span>
      </header>

      <ol className="space-y-4">
        {data.bookings.map((b, i) => (
          <li key={b.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gold-400/60 uppercase tracking-wider">
                  Stop {i + 1} · {b.date} {b.time}
                </p>
                <Link href={`/venues/${b.venue?.slug}`} className="font-display text-2xl text-gold-400 hover:underline">
                  {b.venue?.name}
                </Link>
                <p className="text-xs text-gold-400/60">{b.venue?.address}</p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full border capitalize ${STATUS_TONE[b.status] || ''}`}>
                {b.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <Field label="Type" value={b.request_type.replace('_', ' ')} />
              <Field label="Group" value={`${b.group_size} ppl`} />
              <Field label="Dress" value={b.venue?.dress_code || '—'} />
            </div>
            {b.venue_response && (
              <div className="mt-3 text-sm rounded-xl bg-gold-500/10 border border-gold-500/20 p-3">
                <span className="label">Venue response</span>
                <p className="mt-1">{b.venue_response}</p>
              </div>
            )}
            {b.notes && (
              <p className="mt-2 text-xs text-gold-400/70">Note: {b.notes}</p>
            )}
            <div className="mt-3 flex gap-3">
              <Link href={`/bookings/${b.id}`} className="btn-ghost btn px-2 py-1">Open booking</Link>
              {b.venue?.contact?.phone && (
                <a className="btn-ghost btn px-2 py-1" href={`tel:${b.venue.contact.phone}`}>Call venue</a>
              )}
              {b.venue?.contact?.whatsapp && (
                <a className="btn-ghost btn px-2 py-1" href={`https://wa.me/${b.venue.contact.whatsapp.replace(/\D/g, '')}`} target="_blank">WhatsApp</a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex justify-between">
        <button onClick={load} className="btn btn-secondary">Refresh status</button>
        <Link href={`/feedback/${data.plan_id}`} className="btn btn-ghost">After tonight: leave feedback</Link>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{value}</div>
    </div>
  );
}
