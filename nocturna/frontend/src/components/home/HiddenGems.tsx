'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Venue } from '../../../../shared/types';

export function HiddenGems({ city = 'rome' }: { city?: string }) {
  const [items, setItems] = useState<Venue[]>([]);
  useEffect(() => {
    api.get<Venue[]>(`/api/venues/hidden-gems?city=${city}`).then(setItems).catch(() => setItems([]));
  }, [city]);
  if (!items.length) return <p className="text-gold-400/60">Locals only — loading…</p>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((v) => (
        <Link key={v.id} href={`/venues/${v.slug}`} className="card !p-4 hover:border-gold-500/40 transition">
          <div className="font-medium text-gold-400">{v.name}</div>
          <div className="text-xs text-gold-400/60">{v.neighborhood}</div>
        </Link>
      ))}
    </div>
  );
}
