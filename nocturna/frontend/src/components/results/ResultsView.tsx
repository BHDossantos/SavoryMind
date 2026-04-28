'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Plan } from '../../../../shared/types';
import PlanCard from './PlanCard';

export default function ResultsView() {
  const params = useSearchParams();
  const { t } = useT();
  const ids = (params.get('ids') || '').split(',').filter(Boolean);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(ids.map((id) => api.get<Plan>(`/api/plans/${id}`)))
      .then((rs) => setPlans(rs.filter(Boolean)))
      .finally(() => setLoading(false));
  }, [params]);

  if (loading) return <p className="text-gold-400/70">{t('results.loading')}</p>;
  if (!plans.length) return (
    <div className="text-center py-20">
      <h2 className="font-display text-3xl text-gold-400">{t('results.empty_h')}</h2>
      <p className="mt-2 text-gold-400/60">{t('results.empty_sub')}</p>
      <Link href="/plan/new" className="btn btn-primary mt-6">{t('results.empty_cta')}</Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="label">{t('results.kicker')}</p>
        <h1 className="font-display text-4xl mt-2">{t('results.headline')}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((p) => <PlanCard key={p.id} plan={p} />)}
      </div>
      <div className="text-center">
        <Link href="/plan/new" className="btn btn-secondary">{t('results.regenerate')}</Link>
      </div>
    </div>
  );
}
