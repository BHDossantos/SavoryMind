'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { RouteMap } from '@/components/map/RouteMap';
import type { Venue } from '../../../../../shared/types';

export default function VenueDetail({ params }: { params: { slug: string } }) {
  const [v, setV] = useState<(Venue & { promos: any[]; events: any[] }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.get<any>(`/api/venues/${params.slug}`).then(setV)
      .catch((e) => setErr(e?.message || 'Not found'));
  }, [params.slug]);

  if (err) return <p className="text-accent-500">{err}</p>;
  if (!v) return <p className="text-gold-400/60">Loading…</p>;

  const today = ['mon','tue','wed','thu','fri','sat','sun'][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayHours = (v.opening_hours as any)[today] || [];

  return (
    <article className="max-w-4xl mx-auto space-y-6">
      <header>
        <p className="label">{v.neighborhood} · {v.type}</p>
        <h1 className="font-display text-5xl text-gold-400 mt-2">{v.name}</h1>
        <p className="text-gold-400/70 mt-2">{v.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {v.vibe_tags.map((t) => <span key={t} className="chip">{t}</span>)}
          {v.promoted && <span className="chip !text-accent-500 !border-accent-500/30">Featured</span>}
        </div>
      </header>

      <RouteMap
        height={280}
        showRoute={false}
        points={[{ id: v.id, lat: v.lat, lng: v.lng, label: v.name, sub: v.address }]}
      />

      <section className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><div className="label">Address</div><div>{v.address}</div></div>
        <div><div className="label">Avg per person</div><div>€{v.avg_price_eur}</div></div>
        <div><div className="label">Dress code</div><div className="capitalize">{v.dress_code}</div></div>
        <div><div className="label">Reservation</div><div>{v.reservation_required ? 'Required' : v.walk_in_ok ? 'Walk-in OK' : 'Recommended'}</div></div>
        <div><div className="label">VIP table</div><div>{v.vip_available ? 'Available' : '—'}</div></div>
        <div><div className="label">Best arrival</div><div>{v.best_arrival_time || '—'}</div></div>
        <div><div className="label">Music</div><div>{v.music_types.join(', ') || '—'}</div></div>
        <div><div className="label">Capacity</div><div>{v.capacity || '—'}</div></div>
        <div><div className="label">Today's hours</div><div>{todayHours.map((s: any) => `${s.open}–${s.close}`).join(', ') || 'Closed'}</div></div>
      </section>

      {v.promos?.length > 0 && (
        <section className="card">
          <h2 className="font-display text-2xl">Tonight's offers</h2>
          <ul className="mt-3 space-y-2">
            {v.promos.map((p) => (
              <li key={p.id}><strong className="text-gold-400">{p.title}</strong> — {p.description}</li>
            ))}
          </ul>
        </section>
      )}
      {v.events?.length > 0 && (
        <section className="card">
          <h2 className="font-display text-2xl">Upcoming events</h2>
          <ul className="mt-3 space-y-2">
            {v.events.map((e) => (
              <li key={e.id}>
                <span className="text-gold-400">{new Date(e.starts_at).toLocaleString()}</span>
                {' — '}<strong>{e.title}</strong> · {e.music_types?.join(', ')}
                {e.cover_charge_eur ? ` · €${e.cover_charge_eur} cover` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href={`/bookings/new?venue_id=${v.id}`} className="btn btn-primary">Request reservation</Link>
        {v.vip_available && (
          <Link href={`/bookings/new?venue_id=${v.id}&request_type=vip_table`} className="btn btn-secondary">Request VIP table</Link>
        )}
        <a
          className="btn btn-secondary"
          href={`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&destination_place_id=${encodeURIComponent(v.name)}`}
          target="_blank" rel="noreferrer"
        >Get directions</a>
        {v.contact?.instagram && <a className="btn btn-ghost" href={v.contact.instagram} target="_blank">Instagram</a>}
      </div>
    </article>
  );
}
