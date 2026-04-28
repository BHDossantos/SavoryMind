'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';

export default function Login() {
  const router = useRouter();
  const login = useAuth(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try { const u = await login(email, password); router.push(u.role === 'admin' ? '/admin' : '/me/plans'); }
    catch (e: any) { setErr(e?.message || 'Login failed'); }
  }
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto card space-y-3">
      <h1 className="font-display text-3xl">Sign in</h1>
      <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      {err && <p className="text-accent-500 text-sm">{err}</p>}
      <button className="btn btn-primary w-full">Sign in</button>
      <p className="text-sm text-gold-400/70">No account? <Link href="/signup" className="underline">Sign up</Link></p>
    </form>
  );
}
