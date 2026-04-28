'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function Premium() {
  const [prices, setPrices] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>('/api/payments/prices').then(setPrices); }, []);

  async function buy(purpose: string) {
    const r = await api.post<{ checkout_url: string }>('/api/payments/checkout', { purpose });
    window.location.href = r.checkout_url;
  }

  const plans = prices.filter(p => ['instant_plan', 'premium_date', 'vip_concierge_basic', 'vip_concierge_pro', 'subscription_user'].includes(p.key));
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="font-display text-4xl text-center">Premium concierge</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map(p => (
          <div key={p.key} className="card">
            <p className="label">{p.recurring ? 'Subscription' : 'One-time'}</p>
            <h3 className="font-display text-2xl text-gold-400">{p.label}</h3>
            <p className="font-display text-3xl mt-2">€{p.amount_eur}{p.recurring ? '/mo' : ''}</p>
            <button onClick={() => buy(p.key)} className="btn btn-primary mt-4 w-full">Choose</button>
          </div>
        ))}
      </div>
    </div>
  );
}
