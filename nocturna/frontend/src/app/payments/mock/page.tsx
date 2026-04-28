'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('payment_id');
  const [done, setDone] = useState(false);
  async function confirm() {
    await api.post(`/api/payments/${id}/mock-confirm`); setDone(true);
    setTimeout(() => router.push('/me/plans'), 1500);
  }
  return (
    <div className="card max-w-sm mx-auto text-center">
      <h1 className="font-display text-2xl">Mock checkout</h1>
      <p className="text-gold-400/60 text-sm mt-2">No real Stripe key configured. Click below to mark this payment succeeded for testing.</p>
      {done ? <p className="text-gold-400 mt-4">✔ Confirmed. Redirecting…</p> :
        <button onClick={confirm} className="btn btn-primary mt-4">Pay now (mock)</button>}
    </div>
  );
}

export default function MockCheckout() {
  return <Suspense><Inner /></Suspense>;
}
