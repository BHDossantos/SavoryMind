'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { HeartButton } from '@/components/venue/HeartButton';
import type { Venue } from '../../../../shared/types';

export function TrendingVenues({ city = 'rome' }: { city?: string }) {
  const [items, setItems] = useState<Venue[]>([]);
  useEffect(() => {
    api.get<Venue[]>(`/api/venues/trending?city=${city}`).then(setItems).catch(() => setItems([]));
  }, [city]);
  if (!items.length) return <p className="text-gold-400/60">Loading…</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.slice(0, 6).map((v) => {
        const photo = (v.photos || []).find(Boolean);
        return (
          <Link key={v.id} href={`/venues/${v.slug}`} className="card hover:border-gold-500/40 transition block !p-0 overflow-hidden relative">
            <div className="absolute top-3 right-3 z-10">
              <HeartButton slug={v.slug} name={v.name} />
            </div>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={v.name} className="w-full aspect-[16/9] object-cover" loading="lazy" />
            ) : (
              <div className="w-full aspect-[16/9] bg-gradient-to-br from-night-700 to-night-900 flex items-center justify-center">
                <span className="font-display text-4xl text-gold-400/40">{v.name.charAt(0)}</span>
              </div>
            )}
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-xl text-gold-400 truncate">{v.name}</h3>
                {v.promoted ? <span className="chip shrink-0">Featured</span> : null}
              </div>
              <p className="text-xs text-gold-400/60 mt-1">{v.neighborhood} · {v.type} · €{v.avg_price_eur}/pp</p>
              <p className="text-sm text-white/80 mt-2 line-clamp-2">{v.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {v.vibe_tags.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
