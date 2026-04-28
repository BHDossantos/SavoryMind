'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const CHANNELS = ['email', 'sms', 'whatsapp', 'push'] as const;

interface LogRow {
  id: number; channel: string; recipient: string; subject?: string;
  body: string; provider?: string; status: string; error?: string;
  user_id?: number; booking_id?: number; created_at?: string;
}

export default function AdminNotifications() {
  const [providers, setProviders] = useState<any>(null);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState<{ channel?: string; status?: string }>({});
  const [test, setTest] = useState({ channel: 'email', to: '', subject: 'Nocturna · test', body: 'Hello from Nocturna!' });
  const [testResult, setTestResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function loadProviders() { setProviders(await api.get('/api/admin/notifications/providers')); }
  async function loadLog() {
    const q = new URLSearchParams();
    if (filter.channel) q.set('channel', filter.channel);
    if (filter.status) q.set('status', filter.status);
    setRows(await api.get<LogRow[]>(`/api/admin/notifications/log?${q.toString()}`));
  }
  useEffect(() => { loadProviders(); }, []);
  useEffect(() => { loadLog(); }, [filter]);

  async function fireTest() {
    setBusy(true); setTestResult(null);
    try {
      const r = await api.post('/api/admin/notifications/test', test);
      setTestResult(r);
      loadLog();
    } catch (e: any) {
      setTestResult({ error: e?.message || 'Failed' });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Notifications</h1>
        <Link href="/admin" className="btn btn-ghost">← Admin</Link>
      </div>

      {providers && (
        <section className="card">
          <h2 className="label mb-2">Provider status</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <ProviderPill name="Email · SendGrid" ok={providers.email_sendgrid} />
            <ProviderPill name="SMS · Twilio" ok={providers.sms_twilio} />
            <ProviderPill name="WhatsApp · Twilio" ok={providers.whatsapp_twilio} />
            <ProviderPill name="Push · Expo" ok={providers.push_expo} />
            <ProviderPill name="Stripe" ok={providers.stripe} />
          </div>
          <p className="text-xs text-gold-400/60 mt-3">
            Unconfigured channels still send — they fall back to console logs (visible in
            backend stdout) so the flow doesn't break in dev.
          </p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="label">Send a test notification</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={test.channel} onChange={(e) => setTest({ ...test, channel: e.target.value })}
            className="bg-night-900 border border-white/10 rounded-lg px-3 py-2">
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="recipient (email / +39…/ ExpoPushToken)" value={test.to}
            onChange={(e) => setTest({ ...test, to: e.target.value })}
            className="bg-night-900 border border-white/10 rounded-lg px-3 py-2 md:col-span-2" />
          {(test.channel === 'email' || test.channel === 'push') && (
            <input placeholder="subject" value={test.subject}
              onChange={(e) => setTest({ ...test, subject: e.target.value })}
              className="bg-night-900 border border-white/10 rounded-lg px-3 py-2 md:col-span-3" />
          )}
          <textarea rows={2} placeholder="message body" value={test.body}
            onChange={(e) => setTest({ ...test, body: e.target.value })}
            className="bg-night-900 border border-white/10 rounded-lg px-3 py-2 md:col-span-3" />
        </div>
        <button onClick={fireTest} disabled={busy || !test.to} className="btn btn-primary disabled:opacity-30">
          {busy ? 'Sending…' : 'Send test'}
        </button>
        {testResult && (
          <pre className="text-xs bg-night-900 border border-white/10 rounded p-3 overflow-x-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </section>

      <section className="card space-y-3">
        <header className="flex justify-between items-center">
          <h2 className="label">Delivery log</h2>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setFilter({})}
              className={`chip ${!filter.channel && !filter.status ? '!bg-gold-500 !text-night-950' : ''}`}>all</button>
            {CHANNELS.map(c => (
              <button key={c} onClick={() => setFilter({ channel: c })}
                className={`chip ${filter.channel === c ? '!bg-gold-500 !text-night-950' : ''}`}>{c}</button>
            ))}
            <button onClick={() => setFilter({ status: 'failed' })}
              className={`chip ${filter.status === 'failed' ? '!bg-accent-500 !text-night-950' : ''}`}>failed</button>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gold-400/60 uppercase">
              <th className="py-1">When</th><th>Channel</th><th>Provider</th><th>To</th>
              <th>Status</th><th>Subject / Body</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="py-1 text-gold-400/60">{r.created_at?.slice(11, 19)}</td>
                  <td>{r.channel}</td>
                  <td className="text-gold-400/60">{r.provider}</td>
                  <td className="font-mono">{r.recipient}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] ${
                      r.status === 'sent' ? 'border-gold-500/30 text-gold-400' :
                      r.status === 'failed' ? 'border-red-500/30 text-red-300' :
                      'border-white/10 text-gold-400/60'
                    }`}>{r.status}</span>
                  </td>
                  <td>
                    {r.subject && <strong className="text-gold-400">{r.subject}</strong>}
                    <div className="text-gold-400/70 line-clamp-2 whitespace-pre-wrap">{r.body}</div>
                    {r.error && <div className="text-red-300 mt-1">⚠ {r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-gold-400/60 py-3 text-center">No notifications yet.</p>}
        </div>
      </section>
    </div>
  );
}

function ProviderPill({ name, ok }: { name: string; ok: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-xl border ${ok ? 'border-gold-500/40 text-gold-400' : 'border-white/10 text-gold-400/40'}`}>
      <div className="text-xs">{name}</div>
      <div className="text-xs mt-1">{ok ? '● live' : '○ console fallback'}</div>
    </div>
  );
}
