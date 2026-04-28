'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Feedback({ params }: { params: { planId: string } }) {
  const router = useRouter();
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
      <h1 className="font-display text-3xl text-gold-400">Grazie 🌙</h1>
      <p className="text-gold-400/70 mt-2">Your feedback makes Nocturna smarter.</p>
      <button onClick={() => router.push('/')} className="btn btn-secondary mt-4">Back home</button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto card space-y-4">
      <h1 className="font-display text-3xl">How was your night?</h1>
      {[
        ['rating', 'Overall'],
        ['vibe_accuracy', 'Vibe accuracy'],
        ['crowd_rating', 'Crowd'],
        ['music_rating', 'Music'],
        ['service_rating', 'Service'],
        ['food_rating', 'Food'],
        ['drinks_rating', 'Drinks'],
        ['price_accuracy', 'Price accuracy'],
      ].map(([k, label]) => (
        <Star key={k} label={label} value={(f as any)[k]} onChange={(v) => setF({ ...f, [k]: v })} />
      ))}
      <label className="block">
        <span className="label">How crowded?</span>
        <select value={f.crowded_level} onChange={(e) => setF({ ...f, crowded_level: e.target.value })}
          className="w-full mt-1 bg-night-900 border border-white/10 rounded-lg px-3 py-2">
          <option value="empty">Empty</option><option value="moderate">Moderate</option>
          <option value="busy">Busy</option><option value="packed">Packed</option>
        </select>
      </label>
      <label className="flex gap-2 items-center">
        <input type="checkbox" checked={f.would_return} onChange={(e) => setF({ ...f, would_return: e.target.checked })} />
        I'd go again
      </label>
      <textarea placeholder="Anything to remember?" rows={3} className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2"
        value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} />
      <button onClick={submit} className="btn btn-primary">Submit</button>
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
