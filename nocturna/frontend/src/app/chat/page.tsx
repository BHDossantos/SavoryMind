'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Msg { role: 'user' | 'assistant'; content: string; plans?: any[] }

export default function Chat() {
  const { t } = useT();
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.post<{ session_token: string; greeting: string }>('/api/chat/start', { city: 'rome' }).then((r) => {
      setToken(r.session_token); setMsgs([{ role: 'assistant', content: r.greeting }]);
    });
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }); }, [msgs]);

  async function send() {
    if (!input.trim() || !token) return;
    const text = input.trim();
    setInput(''); setMsgs((m) => [...m, { role: 'user', content: text }]); setBusy(true);
    try {
      const r = await api.post<{ reply: string; plans: any[] }>('/api/chat/send', { session_token: token, message: text });
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply, plans: r.plans }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', content: `Error: ${e?.message || 'try again'}` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-display text-4xl text-center">{t('chat.h')}</h1>
      <p className="text-center text-gold-400/60">{t('chat.sub')}</p>
      <div ref={scrollRef} className="card mt-6 h-[60vh] overflow-y-auto space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[80%] ${m.role === 'user' ? 'ml-auto bg-gold-500/20' : 'bg-night-700/50'} rounded-2xl px-4 py-3`}>
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.plans && m.plans.length > 0 && (
              <div className="mt-3 space-y-2">
                {m.plans.map((p, j) => (
                  <div key={j} className="text-xs border border-gold-500/20 rounded-lg p-2">
                    <strong>{p.label}</strong> · €{p.estimated_cost_eur} · {p.total_travel_min}m
                    <ul className="mt-1 list-disc list-inside">
                      {p.stops.map((s: any) => (
                        <li key={s.venue_id}>
                          {new Date(s.slot_start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} {' — '}
                          <Link href={`/venues/${s.slug}`}>{s.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-gold-400/50">{t('chat.thinking')}</div>}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('chat.placeholder')}
          className="flex-1 bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
        <button onClick={send} className="btn btn-primary" disabled={busy}>{t('common.send')}</button>
      </div>
    </div>
  );
}
