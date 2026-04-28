'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function PartnerProfile() {
  const [f, setF] = useState({ company_name: '', contact_phone: '', contact_whatsapp: '', push_token: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function save() {
    try { await api.post('/api/partner/profile', f); setMsg('Saved.'); }
    catch (e: any) { setMsg(e?.message || 'Failed'); }
  }
  return (
    <div className="max-w-md card space-y-3">
      <h1 className="font-display text-3xl">Partner profile</h1>
      {(['company_name', 'contact_phone', 'contact_whatsapp', 'push_token'] as const).map(k => (
        <input key={k} placeholder={k} value={f[k]} onChange={(e) => set(k, e.target.value)}
          className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      ))}
      <button onClick={save} className="btn btn-primary">Save</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
