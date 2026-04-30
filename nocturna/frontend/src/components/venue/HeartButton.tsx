'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { capture } from '@/lib/analytics';

const KEY = 'nocturna.saved_venues';

function readLocal(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function writeLocal(slugs: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(slugs)); } catch {}
}

export function HeartButton({ slug, name }: { slug: string; name: string }) {
  const [saved, setSaved] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(readLocal().includes(slug));
    // If logged in, the server is the source of truth — sync once.
    if (getToken()) {
      api.get<{ slug: string }[]>('/api/saved-venues').then((rows) => {
        const slugs = rows.map(r => r.slug);
        writeLocal(slugs);
        setSaved(slugs.includes(slug));
      }).catch(() => {});
    }
  }, [slug]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setBusy(true);
    try {
      if (getToken()) {
        const r = await api.post<{ saved: boolean; slugs: string[] }>('/api/saved-venues/toggle', { slug });
        setSaved(r.saved);
        writeLocal(r.slugs);
        capture('venue_saved_toggle', { slug, saved: r.saved, source: 'server' });
      } else {
        const next = readLocal();
        const idx = next.indexOf(slug);
        if (idx >= 0) next.splice(idx, 1); else next.push(slug);
        writeLocal(next);
        setSaved(next.includes(slug));
        capture('venue_saved_toggle', { slug, saved: next.includes(slug), source: 'local' });
      }
    } finally { setBusy(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition disabled:opacity-50 ${
        saved
          ? 'bg-accent-500/20 border-accent-500/40 text-accent-500'
          : 'bg-night-900/70 border-white/10 text-gold-400/70 hover:border-gold-500/40 hover:text-gold-400'
      }`}
    >
      <span className="text-lg leading-none">{saved ? '♥' : '♡'}</span>
    </button>
  );
}
