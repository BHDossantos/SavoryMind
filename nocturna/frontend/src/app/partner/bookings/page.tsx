'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUSES = ['new', 'pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'];

export default function PartnerBookings() {
  const [rows, setRows] = useState<any[]>([]);
  const reload = () => api.get<any[]>('/api/partner/bookings').then(setRows);
  useEffect(() => { reload(); }, []);

  async function update(b: any, status: string) {
    const response = prompt('Response to user (optional):') || undefined;
    await api.put(`/api/partner/bookings/${b.id}/status`, { status, response });
    reload();
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Booking requests</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-gold-400/60">
          <th>#</th><th>Status</th><th>Date</th><th>Group</th><th>Type</th><th>VIP</th><th>Contact</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map(b => (
            <tr key={b.id} className="border-t border-white/5">
              <td>{b.id}</td><td className="capitalize">{b.status}</td>
              <td>{b.date} {b.time}</td><td>{b.group_size}</td>
              <td>{b.request_type}</td><td>{b.vip_interest === 'yes' ? '★' : ''}</td>
              <td>{b.contact_name}<br /><span className="text-xs text-gold-400/60">{b.contact_phone}</span></td>
              <td className="text-right">
                <select onChange={(e) => update(b, e.target.value)} value="" className="bg-night-900 border border-white/10 rounded text-xs">
                  <option value="" disabled>Set…</option>
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
