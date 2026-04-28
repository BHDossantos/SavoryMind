'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function AdminPartners() {
  const [email, setEmail] = useState('');
  const [venueIds, setVenueIds] = useState('');
  const [company, setCompany] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function assign() {
    setMsg(null);
    try {
      const r = await api.post('/api/admin/partner-assignments', {
        user_email: email,
        venue_ids: venueIds.split(',').map(s => Number(s.trim())).filter(Boolean),
        company_name: company || undefined,
      });
      setMsg(`Assigned partner profile (user_id=${(r as any).user_id})`);
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
  }
  return (
    <div className="max-w-md space-y-3">
      <h1 className="font-display text-3xl">Partner assignment</h1>
      <p className="text-gold-400/60 text-sm">Grant a registered user access to manage their venues.</p>
      <input placeholder="Partner email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder="Venue IDs (1,2,3)" value={venueIds} onChange={(e) => setVenueIds(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <button onClick={assign} className="btn btn-primary">Assign</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
