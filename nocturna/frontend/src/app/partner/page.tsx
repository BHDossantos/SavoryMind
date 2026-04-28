'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function PartnerHome() {
  const [analytics, setA] = useState<any>(null);
  const [venues, setV] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/partner/analytics').then(setA).catch(e => setErr(e?.message));
    api.get<any[]>('/api/partner/venues').then(setV).catch(() => {});
  }, []);

  if (err) return <p className="text-accent-500">Partner profile not set up. Ask admin to assign your venues.</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Partner dashboard</h1>
      <nav className="flex gap-2">
        <Link href="/partner/profile" className="btn btn-secondary">Profile</Link>
        <Link href="/partner/bookings" className="btn btn-secondary">Bookings</Link>
        <Link href="/partner/promos" className="btn btn-secondary">Promos</Link>
        <Link href="/partner/events" className="btn btn-secondary">Events</Link>
      </nav>

      {analytics?.summary && (
        <section className="grid md:grid-cols-4 gap-3">
          <Stat label="Requests" value={analytics.summary.total_requests} />
          <Stat label="Confirmed" value={analytics.summary.total_confirmed} />
          <Stat label="VIP" value={analytics.summary.vip_requests} />
          <Stat label="Conversion" value={`${(analytics.summary.conversion_rate * 100).toFixed(0)}%`} />
          <Stat label="Avg group" value={analytics.summary.avg_group_size} />
          <Stat label="Avg budget" value={analytics.summary.avg_budget_eur ? `€${analytics.summary.avg_budget_eur}` : '—'} />
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl">Your venues</h2>
        <ul className="mt-3 space-y-2">
          {venues.map(v => (
            <li key={v.id} className="card flex justify-between items-center">
              <div>
                <strong className="text-gold-400">{v.name}</strong>
                <div className="text-xs text-gold-400/60">{v.type} · {v.active ? 'active' : 'inactive'} · {v.promoted ? 'promoted' : 'not promoted'}</div>
              </div>
              <Link href={`/partner/venues/${v.id}`} className="btn-ghost btn">Manage</Link>
            </li>
          ))}
        </ul>
      </section>

      {analytics?.summary?.top_vibes?.length > 0 && (
        <section className="card">
          <h2 className="label">Most-requested vibes</h2>
          <div className="flex gap-2 flex-wrap mt-2">
            {analytics.summary.top_vibes.map(([v, c]: [string, number]) => (
              <span key={v} className="chip">{v} · {c}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="card"><div className="label">{label}</div><div className="font-display text-3xl text-gold-400">{value}</div></div>;
}
