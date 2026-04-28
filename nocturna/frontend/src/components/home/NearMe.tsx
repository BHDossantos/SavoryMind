'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Venue } from '../../../../shared/types';

interface NearVenue extends Venue { distance_km: number }

export function NearMe() {
  const [venues, setVenues] = useState<NearVenue[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  async function locate() {
    setErr(null); setLoading(true); setVenues(null);
    if (!navigator.geolocation) { setErr('Geolocation not supported'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        try {
          const r = await api.get<NearVenue[]>(`/api/venues/near?lat=${c.lat}&lng=${c.lng}&limit=10&open_now=${openNow}`);
          setVenues(r);
        } catch (e: any) { setErr(e?.message || 'Failed to load'); }
        finally { setLoading(false); }
      },
      (e) => { setErr(e.message || 'Permission denied'); setLoading(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function refresh(open: boolean) {
    setOpenNow(open);
    if (!coords) return;
    setLoading(true);
    try {
      const r = await api.get<NearVenue[]>(`/api/venues/near?lat=${coords.lat}&lng=${coords.lng}&limit=10&open_now=${open}`);
      setVenues(r);
    } finally { setLoading(false); }
  }

  if (!venues) {
    return (
      <div className="card flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="label">Near you</p>
          <h3 className="font-display text-2xl mt-1">Find something around you</h3>
          <p className="text-gold-400/60 text-sm mt-1">We use your location only to rank venues by distance.</p>
        </div>
        <button onClick={locate} disabled={loading} className="btn btn-primary">
          {loading ? 'Locating…' : 'Find venues near me'}
        </button>
        {err && <p className="text-accent-500 text-sm w-full">{err}</p>}
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Near you</p>
          <h3 className="font-display text-2xl mt-1">{venues.length} venues within reach</h3>
        </div>
        <label className="flex items-center gap-2 text-sm text-gold-400/80">
          <input type="checkbox" checked={openNow} onChange={(e) => refresh(e.target.checked)} />
          Open now
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {venues.map(v => (
          <Link key={v.id} href={`/venues/${v.slug}`} className="rounded-xl border border-white/5 p-3 hover:border-gold-500/40">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium text-gold-400 truncate">{v.name}</div>
              <div className="text-xs text-gold-400/70 shrink-0">{v.distance_km} km</div>
            </div>
            <div className="text-xs text-gold-400/60">{v.neighborhood} · {v.type} · €{v.avg_price_eur}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
