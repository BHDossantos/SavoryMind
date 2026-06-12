'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface Me {
  id: number; email: string; email_verified: boolean;
}

/**
 * Soft banner on /me/* pages telling unverified users to check their inbox.
 *
 * Hidden when the user is verified, not signed in, or the request fails.
 * Resend button hits POST /api/auth/resend-verification — debounced via
 * local `sentAt` state so users can't spam it.
 */
export function VerifyBanner() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    api.get<Me>('/api/auth/me').then(setMe).catch(() => setMe(null));
  }, []);

  if (!me || me.email_verified) return null;

  const cooldownLeft = sentAt ? Math.max(0, 30_000 - (Date.now() - sentAt)) : 0;

  async function resend() {
    if (cooldownLeft > 0) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post('/api/auth/resend-verification');
      setSentAt(Date.now());
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || 'Could not resend');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 mb-6 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-gold-400 flex-1 min-w-[200px]">
        Check {me.email} to confirm your email — we use it for booking confirmations + reminders.
      </span>
      <button
        onClick={resend}
        disabled={busy || cooldownLeft > 0}
        className="btn-secondary btn !py-1 !px-3 text-xs disabled:opacity-50"
      >
        {busy ? 'Sending…' : sentAt && cooldownLeft > 0 ? `Sent — wait ${Math.ceil(cooldownLeft / 1000)}s` : sentAt ? 'Send again' : 'Resend email'}
      </button>
      {err && <span className="text-accent-500 text-xs basis-full">{err}</span>}
    </div>
  );
}
