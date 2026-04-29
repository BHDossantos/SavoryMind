'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

const DIMENSIONS = [
  'rating', 'vibe_accuracy', 'crowd_rating', 'music_rating',
  'service_rating', 'food_rating', 'drinks_rating', 'price_accuracy',
] as const;

const CROWD_LEVELS = ['empty', 'moderate', 'busy', 'packed'] as const;

export default function Feedback({ params }: { params: { planId: string } }) {
  const router = useRouter();
  const { t } = useT();
  const [f, setF] = useState({
    rating: 5, vibe_accuracy: 5, crowd_rating: 5, music_rating: 5,
    service_rating: 5, food_rating: 5, drinks_rating: 5, price_accuracy: 5,
    crowded_level: 'busy', would_return: true, comments: '',
  });
  const [done, setDone] = useState(false);

  async function submit() {
    await api.post('/api/reviews', { plan_id: Number(params.planId), ...f });
    setDone(true);
  }

  if (done) return (
    <div className="max-w-md mx-auto card text-center">
      <h1 className="font-display text-3xl text-gold-400">{t('feedback.thanks_h')}</h1>
      <p className="text-gold-400/70 mt-2">{t('feedback.thanks_sub')}</p>
      <button onClick={() => router.push('/')} className="btn btn-secondary mt-4">{t('feedback.back_home')}</button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto card space-y-4">
      <h1 className="font-display text-3xl">{t('feedback.h')}</h1>
      {DIMENSIONS.map((k) => (
        <Star key={k} label={t(`feedback.dim.${k}`)} value={(f as any)[k]} onChange={(v) => setF({ ...f, [k]: v })} />
      ))}
      <label className="block">
        <span className="label">{t('feedback.crowded_label')}</span>
        <select value={f.crowded_level} onChange={(e) => setF({ ...f, crowded_level: e.target.value })}
          className="w-full mt-1 bg-night-900 border border-white/10 rounded-lg px-3 py-2">
          {CROWD_LEVELS.map((c) => (
            <option key={c} value={c}>{t(`feedback.crowded.${c}`)}</option>
          ))}
        </select>
      </label>
      <label className="flex gap-2 items-center">
        <input type="checkbox" checked={f.would_return} onChange={(e) => setF({ ...f, would_return: e.target.checked })} />
        {t('feedback.would_return')}
      </label>
      <textarea placeholder={t('feedback.placeholder')} rows={3} className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2"
        value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} />
      <button onClick={submit} className="btn btn-primary">{t('feedback.submit')}</button>
    </div>
  );
}

function Star({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gold-400/80">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n)} type="button"
            className={`w-7 h-7 rounded-full ${n <= value ? 'bg-gold-500 text-night-950' : 'bg-night-700 text-gold-400/40'}`}>
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
