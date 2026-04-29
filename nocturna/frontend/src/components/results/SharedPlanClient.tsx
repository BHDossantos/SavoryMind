'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Plan } from '../../../../shared/types';
import PlanCard from './PlanCard';

export default function SharedPlanClient({ token, initial }: { token: string; initial: Plan | null }) {
  const [plan, setPlan] = useState<Plan | null>(initial);
  const [err, setErr] = useState<string | null>(initial ? null : null);

  useEffect(() => {
    if (initial) return;
    api.get<Plan>(`/api/plans/share/${token}`).then(setPlan).catch((e) => setErr(e?.message || 'Plan not found'));
  }, [token, initial]);

  if (err) return <p className="text-accent-500">{err}</p>;
  if (!plan) return <p className="text-gold-400/60">Loading shared plan…</p>;
  return (
    <div className="max-w-2xl mx-auto">
      <p className="label text-center">Shared with you</p>
      <h1 className="font-display text-4xl text-center mt-2 mb-6">{plan.label}</h1>
      <PlanCard plan={plan} />
    </div>
  );
}
