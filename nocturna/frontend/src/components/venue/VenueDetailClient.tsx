'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { RouteMap } from '@/components/map/RouteMap';
import { HeartButton } from '@/components/venue/HeartButton';
import type { Venue } from '../../../../shared/types';

type VenueWithExtras = Venue & { promos?: any[]; events?: any[] };

export default function VenueDetailClient({ slug, initial }: {
  slug: string;
  initial?: VenueWithExtras | null;
}) {
  const { t } = useT();
  const [v, setV] = useState<VenueWithExtras | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return; // server-rendered already
    api.get<any>(`/api/venues/${slug}`).then(setV).catch((e) => setErr(e?.message || 'Not found'));
  }, [slug, initial]);

  if (err) return <p className="text-accent-500">{err}</p>;
  if (!v) return <p className="text-gold-400/60">{t('common.loading')}</p>;

  const today = ['mon','tue','wed','thu','fri','sat','sun'][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayHours = (v.opening_hours as any)[today] || [];
  const photos = (v.photos || []).filter(Boolean);

  return (
    <article className="max-w-4xl mx-auto space-y-6">
      {photos.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <div className={`grid gap-1 ${photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-4 grid-rows-2'}`}>
            {photos.slice(0, photos.length === 1 ? 1 : photos.length === 2 ? 2 : 5).map((src, i) => (
              <a
                key={`${src}-${i}`}
                href={src}
                target="_blank"
                rel="noreferrer"
                className={`relative block ${photos.length >= 3 && i === 0 ? 'col-span-2 row-span-2' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${v.name} — photo ${i + 1}`} className="object-cover w-full h-full aspect-[4/3]" loading={i === 0 ? 'eager' : 'lazy'} />
              </a>
            ))}
          </div>
        </div>
      )}
      <header>
        <p className="label">{v.neighborhood} · {v.type}</p>
        <div className="flex items-start justify-between gap-4 mt-2">
          <h1 className="font-display text-5xl text-gold-400">{v.name}</h1>
          <HeartButton slug={v.slug} name={v.name} />
        </div>
        <p className="text-gold-400/70 mt-2">{v.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {v.vibe_tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
          {v.promoted && <span className="chip !text-accent-500 !border-accent-500/30">Featured</span>}
        </div>
      </header>

      <RouteMap
        height={280}
        showRoute={false}
        points={[{ id: v.id, lat: v.lat, lng: v.lng, label: v.name, sub: v.address }]}
      />

      <section className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><div className="label">{t('venue.address')}</div><div>{v.address}</div></div>
        <div><div className="label">{t('venue.avg_pp')}</div><div>€{v.avg_price_eur}</div></div>
        <div><div className="label">{t('venue.dress')}</div><div className="capitalize">{v.dress_code}</div></div>
        <div><div className="label">{t('venue.reservation')}</div><div>{v.reservation_required ? t('venue.reservation_required') : v.walk_in_ok ? t('venue.reservation_walkin') : t('venue.reservation_recommended')}</div></div>
        <div><div className="label">{t('venue.vip')}</div><div>{v.vip_available ? t('venue.vip_available') : '—'}</div></div>
        <div><div className="label">{t('venue.best_arrival')}</div><div>{v.best_arrival_time || '—'}</div></div>
        <div><div className="label">{t('venue.music')}</div><div>{v.music_types.join(', ') || '—'}</div></div>
        <div><div className="label">{t('venue.capacity')}</div><div>{v.capacity || '—'}</div></div>
        <div><div className="label">{t('venue.today_hours')}</div><div>{todayHours.map((s: any) => `${s.open}–${s.close}`).join(', ') || t('venue.closed')}</div></div>
      </section>

      {(v.promos?.length ?? 0) > 0 && (
        <section className="card">
          <h2 className="font-display text-2xl">{t('venue.tonight_offers')}</h2>
          <ul className="mt-3 space-y-2">
            {v.promos!.map((p) => (
              <li key={p.id}><strong className="text-gold-400">{p.title}</strong> — {p.description}</li>
            ))}
          </ul>
        </section>
      )}
      {(v.events?.length ?? 0) > 0 && (
        <section className="card">
          <h2 className="font-display text-2xl">{t('venue.upcoming_events')}</h2>
          <ul className="mt-3 space-y-2">
            {v.events!.map((e) => (
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
        <Link href={`/bookings/new?venue_id=${v.id}`} className="btn btn-primary">{t('venue.cta_reserve')}</Link>
        {v.vip_available && (
          <Link href={`/bookings/new?venue_id=${v.id}&request_type=vip_table`} className="btn btn-secondary">{t('venue.cta_vip')}</Link>
        )}
        <a
          className="btn btn-secondary"
          href={`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&destination_place_id=${encodeURIComponent(v.name)}`}
          target="_blank" rel="noreferrer"
        >{t('venue.cta_directions')}</a>
        {v.contact?.instagram && <a className="btn btn-ghost" href={v.contact.instagram} target="_blank">Instagram</a>}
      </div>
    </article>
  );
}
