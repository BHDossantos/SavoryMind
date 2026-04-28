'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUSES = ['new', 'pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'];

export default function AdminBookings() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  const reload = () => api.get<any[]>(`/api/admin/bookings${filter ? `?status=${filter}` : ''}`).then(setRows);
  useEffect(() => { reload(); }, [filter]);

  async function update(b: any, status: string) {
    const venue_response = prompt('Venue response (optional):') || undefined;
    const commission_eur = status === 'confirmed' ? Number(prompt('Commission (€)') || 0) : undefined;
    await api.put(`/api/admin/bookings/${b.id}`, { status, venue_response, commission_eur });
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Booking requests</h1>
      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`chip ${!filter && '!bg-gold-500 !text-night-950'}`}>all</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`chip ${filter === s && '!bg-gold-500 !text-night-950'}`}>{s}</button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-gold-400/60">
          <th>#</th><th>Status</th><th>Venue</th><th>Date</th><th>Group</th><th>Type</th><th>VIP</th><th>Contact</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map(b => (
            <tr key={b.id} className="border-t border-white/5">
              <td className="py-2">{b.id}</td>
              <td className="capitalize">{b.status}</td>
              <td>{b.venue_id}</td>
              <td>{b.date} {b.time}</td>
              <td>{b.group_size}</td>
              <td>{b.request_type}</td>
              <td>{b.vip_interest === 'yes' ? '★' : ''}</td>
              <td>{b.contact_name}<br /><span className="text-xs text-gold-400/60">{b.contact_phone}</span></td>
              <td className="text-right">
                <select onChange={(e) => update(b, e.target.value)} value="" className="bg-night-900 border border-white/10 rounded text-xs">
                  <option value="" disabled>Set status…</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
