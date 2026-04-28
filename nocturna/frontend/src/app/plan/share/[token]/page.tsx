'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Plan } from '../../../../../../shared/types';
import PlanCard from '@/components/results/PlanCard';

export default function SharePage({ params }: { params: { token: string } }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<Plan>(`/api/plans/share/${params.token}`).then(setPlan)
      .catch((e) => setErr(e?.message || 'Plan not found'));
  }, [params.token]);

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
