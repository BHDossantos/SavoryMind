'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function GroupPage({ params }: { params: { token: string } }) {
  const [g, setG] = useState<any>(null);
  const [voter, setVoter] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    let token = localStorage.getItem('nocturna.voter');
    if (!token) { token = crypto.randomUUID(); localStorage.setItem('nocturna.voter', token); }
    setVoter(token);
    api.get(`/api/groups/${params.token}`).then(setG);
  }, [params.token]);

  async function vote(plan_id: number) {
    const r = await api.post(`/api/groups/${params.token}/vote`, { plan_id, voter_token: voter, voter_name: name || 'Anon' });
    setG(r);
  }
  async function close() {
    const r = await api.post(`/api/groups/${params.token}/close`); setG(r);
  }

  if (!g) return <p className="text-gold-400/60">Loading group…</p>;
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-3xl">{g.title || 'Tonight'}</h1>
      <p className="text-gold-400/60 text-sm">Status: {g.status} · {g.city} · {new Date(g.requested_for).toLocaleString()}</p>
      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
        className="bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <div className="space-y-3">
        {g.options.map((o: any) => (
          <div key={o.plan_id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium text-gold-400">{o.label || `Plan ${o.plan_id}`}</div>
              <div className="text-xs text-gold-400/60">Vibe score {Math.round((o.vibe_score || 0) * 100)}%</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="chip">{g.tally?.[o.plan_id] || 0} votes</span>
              <button onClick={() => vote(o.plan_id)} className="btn btn-primary">Vote</button>
            </div>
          </div>
        ))}
      </div>
      {g.status === 'open' && <button onClick={close} className="btn btn-secondary">Close voting</button>}
      {g.selected_plan_id && <p>Winner: plan {g.selected_plan_id}</p>}
      <p className="text-xs text-gold-400/60">Share: {typeof window !== 'undefined' && `${location.origin}/groups/${g.invite_token}`}</p>
    </div>
  );
}
