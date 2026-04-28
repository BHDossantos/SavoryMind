'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function AdminHome() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.get('/api/admin/dashboard').then(setD).catch(e => setErr(e?.message)); }, []);

  if (err) return <p className="text-accent-500">Admin only — {err}</p>;
  if (!d) return <p>Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Admin · Last {d.days} days</h1>
      <div className="grid md:grid-cols-4 gap-3">
        <Stat label="Users" value={d.users} />
        <Stat label="Venues" value={`${d.active_venues}/${d.venues}`} />
        <Stat label="Plans" value={d.plans_generated} />
        <Stat label="Bookings" value={d.booking_requests} />
        <Stat label="Confirmed" value={d.confirmed_bookings} />
        <Stat label="Conversion" value={`${(d.conversion_rate * 100).toFixed(0)}%`} />
        <Stat label="VIP requests" value={d.vip_requests} />
        <Stat label="Revenue" value={`€${d.revenue_eur}`} />
        <Stat label="Subscriptions" value={d.subscriptions} />
        <Stat label="Promoted" value={d.promoted_venues} />
      </div>
      <nav className="flex gap-3 flex-wrap">
        <Link href="/admin/venues" className="btn btn-secondary">Venues</Link>
        <Link href="/admin/import" className="btn btn-secondary">Import</Link>
        <Link href="/admin/bookings" className="btn btn-secondary">Bookings</Link>
        <Link href="/admin/promos" className="btn btn-secondary">Promos</Link>
        <Link href="/admin/rules" className="btn btn-secondary">Rules</Link>
        <Link href="/admin/cities" className="btn btn-secondary">Cities</Link>
        <Link href="/admin/partners" className="btn btn-secondary">Partners</Link>
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="font-display text-3xl text-gold-400">{value}</div>
    </div>
  );
}
