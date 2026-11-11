'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function Premium() {
  const { t } = useT();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>('/api/payments/prices').then(setPrices).catch(e => setError(e.message)); }, []);

  async function buy(purpose: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
    const r = await api.post<{ checkout_url: string }>('/api/payments/checkout', { purpose });
    window.location.href = r.checkout_url;
    } catch (e: any) { setError(e.status === 401 ? 'Please sign in before purchasing.' : e.message); }
    finally { setBusy(false); }
  }

  const plans = prices.filter(p => ['instant_plan', 'premium_date', 'vip_concierge_basic', 'vip_concierge_pro', 'subscription_user'].includes(p.key));
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="font-display text-4xl text-center">{t('premium.h')}</h1>
      {error && <p role="alert">{error}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map(p => (
          <div key={p.key} className="card">
            <p className="label">{p.recurring ? t('premium.subscription_label') : t('premium.onetime_label')}</p>
            <h3 className="font-display text-2xl text-gold-400">{p.label}</h3>
            <p className="font-display text-3xl mt-2">€{p.amount_eur}{p.recurring ? t('premium.per_mo') : ''}</p>
            <button disabled={busy} onClick={() => buy(p.key)} className="btn btn-primary mt-4 w-full">{t('premium.choose')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
