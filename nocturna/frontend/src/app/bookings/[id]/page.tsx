'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Booking } from '../../../../../shared/types';

export default function BookingPage({ params }: { params: { id: string } }) {
  const { t } = useT();
  const [b, setB] = useState<Booking | null>(null);
  useEffect(() => { api.get<Booking>(`/api/bookings/${params.id}`).then(setB).catch(() => {}); }, [params.id]);
  if (!b) return <p className="text-gold-400/60">{t('common.loading')}</p>;
  return (
    <div className="max-w-xl mx-auto card space-y-3">
      <p className="label">{t('mybook.h', { id: b.id })}</p>
      <h1 className="font-display text-3xl text-gold-400">{b.venue?.name}</h1>
      <p className="text-gold-400/70">{b.venue?.address} · {b.venue?.neighborhood}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="label">{t('mybook.status')}</span><div className="capitalize">{b.status}</div></div>
        <div><span className="label">{t('mybook.date')}</span><div>{b.date} {b.time}</div></div>
        <div><span className="label">{t('mybook.group')}</span><div>{b.group_size}</div></div>
        <div><span className="label">{t('mybook.type')}</span><div>{b.request_type.replace('_',' ')}</div></div>
        <div><span className="label">{t('mybook.dress')}</span><div>{b.venue?.dress_code}</div></div>
        {b.vip_interest === 'yes' && (
          <div><span className="label">{t('mybook.vip')}</span><div>{t('mybook.vip_yes')}</div></div>
        )}
      </div>
      {b.venue_response && (
        <div className="rounded-xl bg-gold-500/10 p-3 text-sm">
          <span className="label">{t('mybook.venue_response')}</span>
          <div>{b.venue_response}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-4">
        {b.plan_id && (
          <Link href={`/plan/${b.plan_id}/bookings`} className="btn btn-secondary">{t('mybook.all_stops')}</Link>
        )}
        {b.plan_id && (
          <Link href={`/feedback/${b.plan_id}`} className="btn btn-ghost">{t('mybook.leave_feedback')}</Link>
        )}
      </div>
    </div>
  );
}
