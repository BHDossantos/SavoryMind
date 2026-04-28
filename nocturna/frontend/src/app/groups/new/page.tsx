'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NewGroup() {
  const router = useRouter();
  const [city, setCity] = useState('rome');
  const [title, setTitle] = useState('Tonight');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [planIds, setPlanIds] = useState('');

  async function create() {
    const r = await api.post<{ invite_token: string }>('/api/groups', {
      city, title,
      requested_for: new Date(date).toISOString(),
      plan_ids: planIds.split(',').map(s => Number(s.trim())).filter(Boolean),
    });
    router.push(`/groups/${r.invite_token}`);
  }

  return (
    <div className="max-w-md mx-auto card space-y-4">
      <h1 className="font-display text-3xl">Plan with friends</h1>
      <p className="text-gold-400/60 text-sm">Invite friends to vote on tonight's plan. Each person picks vibe, budget, and music.</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="city" className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input value={planIds} onChange={(e) => setPlanIds(e.target.value)} placeholder="Plan IDs (comma-sep, optional)" className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <button onClick={create} className="btn btn-primary w-full">Create group</button>
    </div>
  );
}
