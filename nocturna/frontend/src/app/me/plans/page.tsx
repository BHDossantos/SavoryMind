'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { VerifyBanner } from '@/components/me/VerifyBanner';

interface SavedVenue {
  id: number; slug: string; name: string; type: string;
  neighborhood: string; city: string; avg_price_eur: number;
  vibe_tags: string[]; vip_available: boolean; photos: string[];
}

export default function MyPlans() {
  const { t } = useT();
  const [plans, setPlans] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [saved, setSaved] = useState<SavedVenue[] | null>(null);

  useEffect(() => {
    api.get<any[]>('/api/plans/me/list').then(setPlans).catch(() => setPlans([]));
    api.get<any[]>('/api/bookings/me/list').then(setBookings).catch(() => setBookings([]));
    if (getToken()) {
      api.get<SavedVenue[]>('/api/saved-venues').then(setSaved).catch(() => setSaved([]));
    } else {
      // Hydrate from localStorage when guest
      try {
        const slugs = JSON.parse(localStorage.getItem('nocturna.saved_venues') || '[]') as string[];
        if (slugs.length === 0) { setSaved([]); return; }
        Promise.all(slugs.map(s => api.get<any>(`/api/venues/${s}`).catch(() => null)))
          .then(rows => setSaved(rows.filter(Boolean)));
      } catch { setSaved([]); }
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <VerifyBanner />
      <section>
        <h1 className="font-display text-3xl mb-4">{t('myplans.h')}</h1>
        {!plans.length ? <p className="text-gold-400/60">{t('myplans.empty')} <Link href="/plan/new" className="underline">{t('myplans.plan_one')} →</Link></p> : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id} className="card flex items-center justify-between">
                <div>
                  <div className="font-medium text-gold-400">{p.label}</div>
                  <div className="text-xs text-gold-400/60">{p.city} · €{p.estimated_cost_eur} · {p.total_travel_min}m</div>
                </div>
                <Link href={`/plan/results?ids=${p.id}`} className="btn btn-secondary">{t('myplans.open')}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-3xl mb-4">{t('myplans.bookings_h')}</h2>
        {!bookings.length ? <p className="text-gold-400/60">{t('myplans.bookings_empty')}</p> : (
          <ul className="space-y-3">
            {bookings.map((b) => (
              <li key={b.id} className="card">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-gold-400">{b.venue?.name}</div>
                    <div className="text-xs text-gold-400/60">{b.date} {b.time} · {b.group_size} · {b.request_type}</div>
                  </div>
                  <span className="chip capitalize">{b.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-3xl mb-4">{t('myplans.saved_h')}</h2>
        {saved === null ? (
          <p className="text-gold-400/60">{t('common.loading')}</p>
        ) : saved.length === 0 ? (
          <p className="text-gold-400/60">{t('myplans.saved_empty')}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {saved.map((v) => (
              <li key={v.slug} className="card !p-4">
                <Link href={`/venues/${v.slug}`} className="block">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium text-gold-400 truncate">{v.name}</div>
                    {v.vip_available ? <span className="chip">VIP</span> : null}
                  </div>
                  <div className="text-xs text-gold-400/60 mt-1">
                    {v.neighborhood} · {v.city} · {v.type} · €{v.avg_price_eur}/pp
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(v.vibe_tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="chip">{tag}</span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
