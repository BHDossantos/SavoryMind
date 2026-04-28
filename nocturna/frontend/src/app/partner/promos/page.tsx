'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const TYPES = ['happy_hour', 'free_entry', 'ladies_night', 'dj', 'aperitivo', 'vip_special', 'live_event'];

export default function PartnerPromos() {
  const [f, setF] = useState({ venue_id: 0, title: '', type: 'happy_hour', description: '', starts_at: '', ends_at: '', active: true });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  async function create() {
    setMsg(null);
    try {
      await api.post('/api/partner/promos', {
        ...f,
        starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      });
      setMsg('Promo created.');
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
  }
  return (
    <div className="max-w-md card space-y-3">
      <h1 className="font-display text-3xl">Create promo</h1>
      <input placeholder="Venue ID" type="number" value={f.venue_id || ''} onChange={(e) => set('venue_id', Number(e.target.value))}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder="Title" value={f.title} onChange={(e) => set('title', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <select value={f.type} onChange={(e) => set('type', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2">
        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <textarea placeholder="Description" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)}
          className="bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
        <input type="datetime-local" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)}
          className="bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      </div>
      <button onClick={create} className="btn btn-primary">Create</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
