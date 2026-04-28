'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function PartnerEvents() {
  const [f, setF] = useState({
    venue_id: 0, title: '', description: '',
    starts_at: '', ends_at: '', music_types: '', cover_charge_eur: 0, image_url: '', promoted: false,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  async function create() {
    setMsg(null);
    try {
      await api.post('/api/partner/events', {
        venue_id: f.venue_id,
        title: f.title,
        description: f.description,
        starts_at: new Date(f.starts_at).toISOString(),
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
        music_types: f.music_types.split(',').map(s => s.trim()).filter(Boolean),
        cover_charge_eur: f.cover_charge_eur,
        image_url: f.image_url || null,
        promoted: f.promoted,
      });
      setMsg('Event created.');
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
  }
  return (
    <div className="max-w-md card space-y-3">
      <h1 className="font-display text-3xl">Create event</h1>
      <input placeholder="Venue ID" type="number" value={f.venue_id || ''} onChange={(e) => set('venue_id', Number(e.target.value))}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder="Title" value={f.title} onChange={(e) => set('title', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <textarea placeholder="Description" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="datetime-local" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="datetime-local" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder="Music types (house,techno)" value={f.music_types} onChange={(e) => set('music_types', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="number" placeholder="Cover (€)" value={f.cover_charge_eur} onChange={(e) => set('cover_charge_eur', Number(e.target.value))}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder="Image URL" value={f.image_url} onChange={(e) => set('image_url', e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <label className="flex gap-2 items-center text-sm">
        <input type="checkbox" checked={f.promoted} onChange={(e) => set('promoted', e.target.checked)} /> Promoted
      </label>
      <button onClick={create} className="btn btn-primary">Create</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
