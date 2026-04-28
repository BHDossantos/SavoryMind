'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Venue } from '../../../../shared/types';

export function TrendingVenues({ city = 'rome' }: { city?: string }) {
  const [items, setItems] = useState<Venue[]>([]);
  useEffect(() => {
    api.get<Venue[]>(`/api/venues/trending?city=${city}`).then(setItems).catch(() => setItems([]));
  }, [city]);
  if (!items.length) return <p className="text-gold-400/60">Loading…</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.slice(0, 6).map((v) => (
        <Link key={v.id} href={`/venues/${v.slug}`} className="card hover:border-gold-500/40 transition block">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-xl text-gold-400">{v.name}</h3>
            {v.promoted ? <span className="chip">Featured</span> : null}
          </div>
          <p className="text-xs text-gold-400/60 mt-1">{v.neighborhood} · {v.type} · €{v.avg_price_eur}/pp</p>
          <p className="text-sm text-white/80 mt-2 line-clamp-2">{v.description}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {v.vibe_tags.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        </Link>
      ))}
    </div>
  );
}
