'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function Promos() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>('/api/admin/promos').then(setRows); }, []);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Promotions</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-gold-400/60">
          <th>#</th><th>Venue</th><th>Title</th><th>Type</th><th>From</th><th>To</th><th>Active</th>
        </tr></thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id} className="border-t border-white/5">
              <td>{p.id}</td><td>{p.venue_id}</td><td>{p.title}</td><td>{p.type}</td>
              <td>{p.starts_at?.slice(0,10) || ''}</td><td>{p.ends_at?.slice(0,10) || ''}</td>
              <td>{p.active ? '✓' : '✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
