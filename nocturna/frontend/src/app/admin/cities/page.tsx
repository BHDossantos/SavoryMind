'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminCities() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>('/api/cities').then(setRows); }, []);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Cities</h1>
      <ul className="grid md:grid-cols-2 gap-3">
        {rows.map(c => (
          <li key={c.slug} className="card">
            <h3 className="font-display text-2xl text-gold-400">{c.name}</h3>
            <div className="text-xs text-gold-400/60">{c.country} · {c.timezone} · {c.currency}</div>
            <div className="mt-2 text-sm">{c.neighborhoods.join(' · ')}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
