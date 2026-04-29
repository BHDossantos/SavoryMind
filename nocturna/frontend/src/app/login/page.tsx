'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';

export default function Login() {
  const router = useRouter();
  const { t } = useT();
  const login = useAuth(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try { const u = await login(email, password); router.push(u.role === 'admin' ? '/admin' : '/me/plans'); }
    catch (e: any) { setErr(e?.message || t('auth.fail')); }
  }
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto card space-y-3">
      <h1 className="font-display text-3xl">{t('auth.signin_h')}</h1>
      <input type="email" placeholder={t('common.email')} required value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="password" placeholder={t('common.password')} required value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      {err && <p className="text-accent-500 text-sm">{err}</p>}
      <button className="btn btn-primary w-full">{t('auth.signin_h')}</button>
      <p className="text-sm text-gold-400/70">{t('auth.no_account')} <Link href="/signup" className="underline">{t('auth.signup_link')}</Link></p>
    </form>
  );
}
