'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function MyPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>('/api/plans/me/list').then(setPlans).catch(() => setPlans([]));
    api.get<any[]>('/api/bookings/me/list').then(setBookings).catch(() => setBookings([]));
  }, []);
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <h1 className="font-display text-3xl mb-4">My plans</h1>
        {!plans.length ? <p className="text-gold-400/60">No plans yet. <Link href="/plan/new" className="underline">Plan one →</Link></p> : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id} className="card flex items-center justify-between">
                <div>
                  <div className="font-medium text-gold-400">{p.label}</div>
                  <div className="text-xs text-gold-400/60">{p.city} · €{p.estimated_cost_eur} · {p.total_travel_min}m</div>
                </div>
                <Link href={`/plan/results?ids=${p.id}`} className="btn btn-secondary">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-3xl mb-4">My bookings</h2>
        {!bookings.length ? <p className="text-gold-400/60">No bookings yet.</p> : (
          <ul className="space-y-3">
            {bookings.map((b) => (
              <li key={b.id} className="card">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-gold-400">{b.venue?.name}</div>
                    <div className="text-xs text-gold-400/60">{b.date} {b.time} · {b.group_size} ppl · {b.request_type}</div>
                  </div>
                  <span className="chip capitalize">{b.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
