'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Status = 'pending' | 'ok' | 'error';

export default function VerifyPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ ok: boolean; email: string }>(`/api/auth/verify/${params.token}`);
        if (!cancelled) {
          setStatus('ok');
          setMessage(`Email verified${r.email ? ` (${r.email})` : ''}.`);
        }
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error');
          setMessage(e?.data?.detail || e?.message || 'Verification failed.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [params.token]);

  return (
    <div className="max-w-md mx-auto card text-center space-y-4 mt-8">
      <h1 className="font-display text-3xl text-gold-400">
        {status === 'pending' && 'Confirming…'}
        {status === 'ok' && 'You are verified'}
        {status === 'error' && 'Could not verify'}
      </h1>
      <p className="text-gold-400/70 text-sm">{message}</p>
      {status === 'ok' && (
        <Link href="/me/plans" className="btn btn-primary inline-block">Go to my nights</Link>
      )}
      {status === 'error' && (
        <Link href="/login" className="btn btn-secondary inline-block">Back to sign in</Link>
      )}
    </div>
  );
}
