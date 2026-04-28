'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Booking } from '../../../../../shared/types';

export default function BookingPage({ params }: { params: { id: string } }) {
  const [b, setB] = useState<Booking | null>(null);
  useEffect(() => { api.get<Booking>(`/api/bookings/${params.id}`).then(setB).catch(() => {}); }, [params.id]);
  if (!b) return <p className="text-gold-400/60">Loading…</p>;
  return (
    <div className="max-w-xl mx-auto card space-y-3">
      <p className="label">Booking #{b.id}</p>
      <h1 className="font-display text-3xl text-gold-400">{b.venue?.name}</h1>
      <p className="text-gold-400/70">{b.venue?.address} · {b.venue?.neighborhood}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="label">Status</span><div className="capitalize">{b.status}</div></div>
        <div><span className="label">Date</span><div>{b.date} {b.time}</div></div>
        <div><span className="label">Group</span><div>{b.group_size} people</div></div>
        <div><span className="label">Type</span><div>{b.request_type.replace('_',' ')}</div></div>
        <div><span className="label">Dress</span><div>{b.venue?.dress_code}</div></div>
        {b.vip_interest === 'yes' && <div><span className="label">VIP</span><div>Yes</div></div>}
      </div>
      {b.venue_response && (
        <div className="rounded-xl bg-gold-500/10 p-3 text-sm">
          <span className="label">Venue response</span>
          <div>{b.venue_response}</div>
        </div>
      )}
      <p className="text-xs text-gold-400/60">
        We'll confirm shortly. You can also reach the venue at {b.venue?.contact?.phone || '—'}.
      </p>
      {b.plan_id && <Link href={`/feedback/${b.plan_id}`} className="btn btn-secondary mt-4">After your night, leave feedback</Link>}
    </div>
  );
}
