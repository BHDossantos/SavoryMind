'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const STATUSES = ['new', 'pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'] as const;
type Status = typeof STATUSES[number];

interface BookingRow {
  id: number; status: Status;
  venue_id: number;
  plan_id?: number | null;
  date: string; time: string;
  group_size: number;
  request_type: string;
  vip_interest: 'yes' | 'no';
  budget_eur?: number | null;
  bottle_preference?: string | null;
  arrival_time?: string | null;
  contact_name: string; contact_phone: string; contact_email: string;
  notes?: string | null;
  admin_notes?: string | null;
  venue_response?: string | null;
  commission_eur: number;
  reminder_sent_at?: string | null;
  created_at?: string | null;
  venue?: {
    id: number; slug: string; name: string; neighborhood: string; city: string;
    address: string; phone?: string; whatsapp?: string; dress_code?: string;
  } | null;
}

const STATUS_TONE: Record<string, string> = {
  new: 'bg-night-700/40 text-gold-400/80 border-white/10',
  pending: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  rejected: 'bg-red-900/30 text-red-300 border-red-700/40',
  cancelled: 'bg-red-900/20 text-red-300/70 border-red-700/30',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  no_show: 'bg-red-900/30 text-red-300 border-red-700/40',
};

export default function AdminBookings() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [filter, setFilter] = useState<Status | ''>('');
  const [vip, setVip] = useState(false);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  async function reload() {
    const sp = new URLSearchParams();
    if (filter) sp.set('status', filter);
    if (vip) sp.set('vip', 'true');
    if (q.trim()) sp.set('q', q.trim());
    setRows(await api.get<BookingRow[]>(`/api/admin/bookings?${sp.toString()}`));
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, vip]);
  useEffect(() => {
    const handle = setTimeout(reload, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function update(b: BookingRow, status: Status, prompts?: { askResponse?: boolean; askCommission?: boolean }) {
    let venue_response: string | undefined;
    let commission_eur: number | undefined;
    if (prompts?.askResponse) {
      const v = window.prompt(`Reply from ${b.venue?.name || 'venue'} to ${b.contact_name} (will be emailed):`, b.venue_response || '');
      if (v === null) return;
      venue_response = v;
    }
    if (prompts?.askCommission) {
      const v = window.prompt(`Commission for booking #${b.id} (€):`, String(b.commission_eur || ''));
      if (v === null) return;
      const n = Number(v);
      if (!Number.isNaN(n)) commission_eur = n;
    }
    setBusyId(b.id);
    try {
      await api.put(`/api/admin/bookings/${b.id}`, { status, venue_response, commission_eur });
      await reload();
    } finally { setBusyId(null); }
  }

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    rows.forEach(r => { out[r.status] = (out[r.status] || 0) + 1; });
    return out;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl">Booking requests</h1>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / phone / email"
            className="bg-night-900 border border-white/10 rounded-lg px-3 py-2 text-sm w-64"
          />
          <label className="flex items-center gap-2 text-xs text-gold-400/80">
            <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} />
            VIP only
          </label>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <Chip active={!filter} onClick={() => setFilter('')}>all</Chip>
        {STATUSES.map(s => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {s.replace('_', ' ')}{counts[s] ? ` · ${counts[s]}` : ''}
          </Chip>
        ))}
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-gold-400/60 py-8 text-center">No bookings match these filters.</p>
        )}
        {rows.map(b => {
          const wa = b.venue?.whatsapp ? b.venue.whatsapp.replace(/\D/g, '') : null;
          const venuePhone = b.venue?.phone;
          const isOpen = openId === b.id;
          return (
            <div key={b.id} className="card !p-4">
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 items-start">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gold-400/60">#{b.id}</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] capitalize ${STATUS_TONE[b.status] || ''}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                  {b.vip_interest === 'yes' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent-500/40 text-accent-500">VIP</span>
                  )}
                  {b.reminder_sent_at && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-gold-400/60" title={b.reminder_sent_at}>
                      reminded
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {b.venue?.slug ? (
                        <Link href={`/venues/${b.venue.slug}`} className="hover:text-gold-400">{b.venue.name}</Link>
                      ) : `Venue #${b.venue_id}`}
                    </div>
                    <div className="text-xs text-gold-400/60">{b.venue?.neighborhood} · {b.venue?.city}</div>
                  </div>
                  <div>
                    <div>{b.date} · <strong>{b.time}</strong></div>
                    <div className="text-xs text-gold-400/60">{b.group_size} ppl · {b.request_type.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="truncate">{b.contact_name}</div>
                    <div className="text-xs text-gold-400/60 truncate">
                      <a href={`tel:${b.contact_phone}`} className="hover:text-gold-400">{b.contact_phone}</a>
                    </div>
                    <div className="text-xs text-gold-400/60 truncate">
                      <a href={`mailto:${b.contact_email}`} className="hover:text-gold-400">{b.contact_email}</a>
                    </div>
                  </div>
                  <div className="text-xs text-gold-400/60">
                    {b.budget_eur ? <div>Budget: €{b.budget_eur}</div> : null}
                    {b.commission_eur ? <div>Commission: €{b.commission_eur}</div> : null}
                    {b.plan_id ? <div><Link href={`/plan/${b.plan_id}/bookings`} className="underline">Plan #{b.plan_id}</Link></div> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 justify-end">
                  {b.status === 'new' && (
                    <ActionBtn busy={busyId === b.id} kind="ghost" onClick={() => update(b, 'pending')}>
                      Mark pending
                    </ActionBtn>
                  )}
                  {(b.status === 'new' || b.status === 'pending') && (
                    <>
                      <ActionBtn busy={busyId === b.id} kind="primary"
                        onClick={() => update(b, 'confirmed', { askResponse: true, askCommission: true })}>
                        Confirm
                      </ActionBtn>
                      <ActionBtn busy={busyId === b.id} kind="danger"
                        onClick={() => update(b, 'rejected', { askResponse: true })}>
                        Reject
                      </ActionBtn>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <ActionBtn busy={busyId === b.id} kind="ghost" onClick={() => update(b, 'completed')}>
                      Mark completed
                    </ActionBtn>
                  )}
                  {wa && (
                    <a className="text-xs rounded-full px-3 py-1.5 text-gold-400 hover:bg-gold-500/10 border border-white/10"
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`Ciao, sono Nocturna — booking #${b.id} per ${b.contact_name} (${b.group_size}p) il ${b.date} alle ${b.time}.`)}`}
                      target="_blank" rel="noreferrer">
                      WhatsApp venue
                    </a>
                  )}
                  {venuePhone && (
                    <a className="text-xs rounded-full px-3 py-1.5 text-gold-400 hover:bg-gold-500/10 border border-white/10" href={`tel:${venuePhone}`}>
                      Call venue
                    </a>
                  )}
                  <button className="text-xs rounded-full px-3 py-1.5 text-gold-400 hover:bg-gold-500/10 border border-white/10"
                    onClick={() => setOpenId(isOpen ? null : b.id)}>
                    {isOpen ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-white/5 text-sm grid md:grid-cols-2 gap-4">
                  <div>
                    {b.notes && <DetailRow label="User notes" value={b.notes} />}
                    {b.bottle_preference && <DetailRow label="Bottle preference" value={b.bottle_preference} />}
                    {b.arrival_time && <DetailRow label="Arrival time" value={b.arrival_time} />}
                    {b.created_at && <DetailRow label="Submitted" value={new Date(b.created_at).toLocaleString()} />}
                  </div>
                  <div>
                    {b.venue?.address && <DetailRow label="Address" value={b.venue.address} />}
                    {b.venue?.dress_code && <DetailRow label="Dress" value={b.venue.dress_code} />}
                    {b.venue_response && <DetailRow label="Venue response" value={b.venue_response} />}
                    {b.admin_notes && <DetailRow label="Admin notes" value={b.admin_notes} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`chip ${active ? '!bg-gold-500 !text-night-950 !border-gold-500' : ''}`}>
      {children}
    </button>
  );
}

function ActionBtn({ busy, kind, onClick, children }: {
  busy: boolean; kind: 'primary' | 'danger' | 'ghost'; onClick: () => void; children: React.ReactNode;
}) {
  const cls = kind === 'primary'
    ? 'bg-gold-500 text-night-950 hover:bg-gold-400'
    : kind === 'danger'
      ? 'bg-red-900/40 text-red-200 hover:bg-red-800/60 border border-red-700/40'
      : 'text-gold-400 hover:bg-gold-500/10 border border-white/10';
  return (
    <button onClick={onClick} disabled={busy}
      className={`text-xs rounded-full px-3 py-1.5 transition disabled:opacity-30 ${cls}`}>
      {busy ? '…' : children}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <div className="label">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}
