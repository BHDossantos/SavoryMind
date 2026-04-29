'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';

export default function Signup() {
  const router = useRouter();
  const { t } = useT();
  const reg = useAuth(s => s.register);
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '' });
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try { await reg(f.email, f.password, f.name, f.phone); router.push('/me/plans'); }
    catch (e: any) { setErr(e?.message || t('auth.fail')); }
  }
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto card space-y-3">
      <h1 className="font-display text-3xl">{t('auth.signup_h')}</h1>
      <input placeholder={t('book.field.name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="email" placeholder={t('common.email')} required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder={t('book.field.phone')} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="password" placeholder={t('common.password')} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      {err && <p className="text-accent-500 text-sm">{err}</p>}
      <button className="btn btn-primary w-full">{t('auth.signup_h')}</button>
    </form>
  );
}
