'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { capture } from '@/lib/analytics';
import { RouteMap } from '@/components/map/RouteMap';
import type { Plan } from '../../../../shared/types';

export default function PlanCard({ plan }: { plan: Plan }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function handleShare() {
    const r = await api.post<{ share_url: string; share_token: string }>(`/api/plans/${plan.id}/share`);
    const url = `${window.location.origin}/plan/share/${r.share_token}`;
    setShareUrl(url);
    capture('plan_shared', { plan_id: plan.id, channel: typeof navigator.share === 'function' ? 'system' : 'clipboard' });
    if (typeof navigator.share === 'function') navigator.share({ title: plan.label, url }).catch(() => {});
    else navigator.clipboard.writeText(url);
  }

  return (
    <article className="card flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">{plan.intent.replace('_', ' ')}</p>
          <h3 className="font-display text-2xl text-gold-400 mt-1">{plan.label}</h3>
        </div>
        {plan.dress_code && <span className="chip">Dress: {plan.dress_code}</span>}
      </div>

      <div className="mt-4">
        <RouteMap
          height={180}
          points={plan.stops.map((s, i) => ({
            id: s.venue_id, lat: s.lat, lng: s.lng,
            label: `${i + 1}. ${s.name}`, sub: s.neighborhood,
          }))}
        />
      </div>

      <ol className="mt-5 space-y-4">
        {plan.stops.map((s) => (
          <li key={s.venue_id} className="border-l-2 border-gold-500/30 pl-4">
            <div className="text-xs text-gold-400/60 uppercase tracking-wider">
              {new Date(s.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.slot_role}
            </div>
            <Link href={`/venues/${s.slug}`} className="font-medium text-white hover:text-gold-400">{s.name}</Link>
            <div className="text-xs text-gold-400/60">{s.summary}{s.promoted ? ' · Featured' : ''}</div>
            {s.travel_to_next_min > 0 && (
              <div className="text-xs text-gold-400/40 mt-1">↓ {s.travel_to_next_min} min travel</div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <div><div className="label">Cost</div><div className="font-display text-xl">€{plan.estimated_cost_eur}</div></div>
        <div><div className="label">Travel</div><div className="font-display text-xl">{plan.total_travel_min}m</div></div>
        <div><div className="label">Vibe</div><div className="font-display text-xl">{Math.round(plan.vibe_score * 100)}%</div></div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link className="btn btn-primary flex-1" href={`/bookings/new?plan_id=${plan.id}`}>
          Book this plan
        </Link>
        <button onClick={handleShare} className="btn btn-secondary">Share</button>
      </div>
      {shareUrl && <p className="text-xs text-gold-400/60 mt-2 truncate">{shareUrl}</p>}
    </article>
  );
}
