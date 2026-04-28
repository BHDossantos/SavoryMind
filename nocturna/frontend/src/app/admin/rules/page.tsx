'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function Rules() {
  const [rules, setRules] = useState<any>(null);
  const [weights, setWeights] = useState<any>({});

  useEffect(() => { api.get('/api/admin/rules').then((r: any) => { setRules(r); setWeights(r.weights); }); }, []);

  async function save() {
    const r = await api.put('/api/admin/rules/weights', { weights });
    setWeights((r as any).weights);
  }

  if (!rules) return <p>Loading…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-display text-3xl">Recommendation rules</h1>
      <div className="card space-y-2">
        <h2 className="label">Scoring weights</h2>
        {Object.entries(weights).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-32 text-sm text-gold-400/80">{k}</span>
            <input type="number" step="0.01" value={v as number}
              onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              className="bg-night-900 border border-white/10 rounded px-2 py-1 text-sm w-28" />
          </div>
        ))}
        <button onClick={save} className="btn btn-primary mt-3">Save weights</button>
      </div>
      <div className="card">
        <h2 className="label">Hard rules</h2>
        <ul className="text-sm space-y-1 mt-2 text-gold-400/80">
          <li>Don't recommend closed venues.</li>
          <li>Clubs only after {rules.club_hour_minimum}.</li>
          <li>Max travel between stops: {rules.max_total_travel_min_default} min.</li>
          <li>Promoted venues capped at {rules.promoted_per_plan_cap} per plan.</li>
          <li>Dress mismatches more than 1 level blocked.</li>
        </ul>
      </div>
    </div>
  );
}
