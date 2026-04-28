'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminVenues() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const reload = () => api.get<any[]>(`/api/admin/venues${q ? `?q=${q}` : ''}`).then(setRows);
  useEffect(() => { reload(); }, [q]);

  async function save(v: any) {
    if (v.id) await api.put(`/api/admin/venues/${v.id}`, v);
    else await api.post('/api/admin/venues', v);
    setEditing(null); reload();
  }
  async function del(id: number) {
    if (!confirm('Delete?')) return;
    await api.del(`/api/admin/venues/${id}`); reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Venues</h1>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
          <button onClick={() => setEditing(BLANK)} className="btn btn-primary">+ New venue</button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gold-400/60 text-xs uppercase">
          <th>Name</th><th>Type</th><th>City</th><th>Hood</th><th>€</th><th>Promoted</th><th>Active</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map(v => (
            <tr key={v.id} className="border-t border-white/5">
              <td className="py-2">{v.name}</td><td>{v.type}</td><td>{v.city}</td><td>{v.neighborhood}</td>
              <td>€{v.avg_price_eur}</td><td>{v.promoted ? '★' : ''}</td><td>{v.active ? '✓' : '✗'}</td>
              <td className="text-right">
                <button onClick={() => setEditing(v)} className="btn-ghost btn px-2 py-1">Edit</button>
                <button onClick={() => del(v.id)} className="btn-ghost btn px-2 py-1">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && <VenueModal v={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

const BLANK = {
  slug: '', name: '', type: 'restaurant', address: '', lat: 41.9, lng: 12.5,
  neighborhood: 'Centro', city: 'rome', country: 'IT', opening_hours: {},
  price_level: 2, avg_price_eur: 60, dress_code: 'casual',
  music_types: [], crowd_types: [], vibe_tags: [], cuisine_tags: [],
  reservation_required: false, walk_in_ok: true, vip_available: false, guestlist_required: false,
  contact: {}, photos: [], promoted: false, partner_status: 'none', commission_pct: 0,
  best_nights: [], active: true, quality_score: 0.8,
};

function VenueModal({ v, onClose, onSave }: { v: any; onClose: () => void; onSave: (v: any) => void }) {
  const [data, setData] = useState<any>(v);
  const set = (k: string, val: any) => setData({ ...data, [k]: val });
  return (
    <div className="fixed inset-0 bg-black/70 grid place-items-center z-50 p-4 overflow-y-auto">
      <div className="card max-w-2xl w-full space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-2xl">{data.id ? 'Edit' : 'New'} venue</h2>
        <div className="grid grid-cols-2 gap-2">
          <Field k="name" data={data} set={set} />
          <Field k="slug" data={data} set={set} />
          <Field k="type" data={data} set={set} />
          <Field k="city" data={data} set={set} />
          <Field k="neighborhood" data={data} set={set} />
          <Field k="address" data={data} set={set} />
          <Field k="lat" data={data} set={set} type="number" />
          <Field k="lng" data={data} set={set} type="number" />
          <Field k="avg_price_eur" data={data} set={set} type="number" />
          <Field k="price_level" data={data} set={set} type="number" />
          <Field k="dress_code" data={data} set={set} />
          <Field k="best_arrival_time" data={data} set={set} />
        </div>
        <ArrayField k="vibe_tags" data={data} set={set} />
        <ArrayField k="music_types" data={data} set={set} />
        <ArrayField k="crowd_types" data={data} set={set} />
        <div className="grid grid-cols-3 gap-2">
          <Bool k="active" data={data} set={set} />
          <Bool k="promoted" data={data} set={set} />
          <Bool k="vip_available" data={data} set={set} />
          <Bool k="reservation_required" data={data} set={set} />
          <Bool k="walk_in_ok" data={data} set={set} />
          <Bool k="guestlist_required" data={data} set={set} />
        </div>
        <Field k="quality_score" data={data} set={set} type="number" />
        <Field k="partner_status" data={data} set={set} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={() => onSave(data)} className="btn btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
function Field({ k, data, set, type = 'text' }: any) {
  return <label className="block text-xs text-gold-400/60">{k}
    <input type={type} value={data[k] ?? ''} onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)}
      className="block w-full mt-1 bg-night-900 border border-white/10 rounded px-2 py-1 text-sm" />
  </label>;
}
function Bool({ k, data, set }: any) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox"
    checked={!!data[k]} onChange={(e) => set(k, e.target.checked)} /> {k}</label>;
}
function ArrayField({ k, data, set }: any) {
  return <label className="block text-xs text-gold-400/60">{k} (comma-sep)
    <input value={(data[k] || []).join(',')} onChange={(e) => set(k, e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean))}
      className="block w-full mt-1 bg-night-900 border border-white/10 rounded px-2 py-1 text-sm" />
  </label>;
}
