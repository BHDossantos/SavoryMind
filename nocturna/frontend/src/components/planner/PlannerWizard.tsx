'use client';
import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { capture } from '@/lib/analytics';
import { useT } from '@/lib/i18n';
import {
  BUDGET_BANDS, CITIES, GROUP_TYPES, INTENTS, MUSIC, STYLES, TIME_OPTIONS, VIBES,
} from '../../../../shared/constants/options';

const STEPS = ['city', 'intent', 'when', 'vibe', 'music', 'budget', 'group', 'style', 'review'] as const;
type Step = typeof STEPS[number];

interface FormState {
  city: string;
  intent: string;
  when: string;
  whenDate?: string;
  vibe_tags: string[];
  music_pref: string[];
  budget_band: string;
  budget_per_person: number;
  group_type: string;
  group_size: number;
  style: string;
  neighborhood_pref: string[];
  accept_long_route: boolean;
}

export default function PlannerWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useT();
  const [step, setStep] = useState<Step>('city');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    city: params.get('city') || 'rome',
    intent: params.get('intent') || 'dinner_drinks',
    when: 'tonight',
    vibe_tags: [],
    music_pref: [],
    budget_band: '50-100',
    budget_per_person: 75,
    group_type: 'friends',
    group_size: 2,
    style: 'casual',
    neighborhood_pref: [],
    accept_long_route: false,
  });

  const stepIdx = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => setStep(STEPS[Math.max(stepIdx - 1, 0)]);
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });

  const requestedFor = useMemo(() => {
    const now = new Date();
    if (form.when === 'now') return now.toISOString();
    if (form.when === 'tonight') {
      const d = new Date(); d.setHours(21, 0, 0, 0);
      if (d < now) d.setDate(d.getDate() + 1);
      return d.toISOString();
    }
    if (form.when === 'tomorrow') {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(21, 0, 0, 0); return d.toISOString();
    }
    if (form.when === 'weekend') {
      const d = new Date(); const dow = d.getDay(); const add = (5 - dow + 7) % 7 || 1;
      d.setDate(d.getDate() + add); d.setHours(21, 0, 0, 0); return d.toISOString();
    }
    return form.whenDate ? new Date(form.whenDate).toISOString() : now.toISOString();
  }, [form.when, form.whenDate]);

  async function submit() {
    setSubmitting(true); setError(null);
    capture('planner_submitted', {
      city: form.city, intent: form.intent, vibe_tags: form.vibe_tags,
      group_type: form.group_type, group_size: form.group_size,
      budget_band: form.budget_band, style: form.style,
    });
    try {
      const r = await api.post<{ plans: { id: number }[] }>('/api/planner/generate', {
        city: form.city,
        requested_for: requestedFor,
        intent: form.intent,
        vibe_tags: form.vibe_tags,
        music_pref: form.music_pref,
        style: form.style,
        group_type: form.group_type,
        group_size: form.group_size,
        budget_band: form.budget_band,
        budget_per_person: form.budget_per_person,
        neighborhood_pref: form.neighborhood_pref,
        accept_long_route: form.accept_long_route,
        plan_count: 3,
      });
      capture('plan_generated', {
        plans_count: r.plans.length, city: form.city, intent: form.intent,
      });
      const ids = r.plans.map((p) => p.id).join(',');
      router.push(`/plan/results?ids=${ids}`);
    } catch (e: any) {
      capture('planner_failed', { error: e?.message, city: form.city, intent: form.intent });
      setError(e?.message || 'Could not generate a plan.');
    } finally {
      setSubmitting(false);
    }
  }

  const Toggle = ({ value, options, multi = false, onChange }: {
    value: string | string[]; options: readonly (string | { value: string; label: string })[];
    multi?: boolean; onChange: (v: any) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o.replace(/_/g, ' ') : o.label;
        const active = multi ? (value as string[]).includes(v) : value === v;
        return (
          <button key={v} onClick={() => {
            if (multi) {
              const arr = value as string[];
              onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
            } else onChange(v);
          }}
            className={`px-4 py-2 rounded-full text-sm border transition ${
              active ? 'bg-gold-500 text-night-950 border-gold-500' : 'border-white/10 text-gold-400 hover:border-gold-500/40'
            }`}>
            {l}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-xs text-gold-400/60 mb-2">{t('planner.step', { n: stepIdx + 1, total: STEPS.length })}</div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-8">
        <div className="h-full bg-gold-500" style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="card space-y-6">
        {step === 'city' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.city')}</h2>
            <Toggle value={form.city} options={CITIES.map(c => ({ value: c.slug, label: c.label }))}
              onChange={(v) => set({ city: v })} />
          </>
        )}
        {step === 'intent' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.intent')}</h2>
            <Toggle value={form.intent} options={INTENTS} onChange={(v) => set({ intent: v })} />
          </>
        )}
        {step === 'when' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.when')}</h2>
            <Toggle value={form.when} options={TIME_OPTIONS} onChange={(v) => set({ when: v })} />
            {form.when === 'specific' && (
              <input type="datetime-local" className="bg-night-900 border border-white/10 rounded-lg px-3 py-2"
                value={form.whenDate || ''} onChange={(e) => set({ whenDate: e.target.value })} />
            )}
          </>
        )}
        {step === 'vibe' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.vibe')}</h2>
            <p className="text-gold-400/60 text-sm">{t('planner.q.vibe_sub')}</p>
            <Toggle multi value={form.vibe_tags} options={VIBES as any} onChange={(v) => set({ vibe_tags: v })} />
          </>
        )}
        {step === 'music' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.music')}</h2>
            <Toggle multi value={form.music_pref} options={MUSIC as any} onChange={(v) => set({ music_pref: v })} />
          </>
        )}
        {step === 'budget' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.budget')}</h2>
            <Toggle value={form.budget_band} options={BUDGET_BANDS.map(b => ({ value: b.value, label: b.label }))}
              onChange={(v) => {
                const b = BUDGET_BANDS.find(x => x.value === v);
                set({ budget_band: v, budget_per_person: b?.perPerson || 75 });
              }} />
          </>
        )}
        {step === 'group' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.group')}</h2>
            <Toggle value={form.group_type} options={GROUP_TYPES as any} onChange={(v) => set({ group_type: v })} />
            <label className="block mt-2 text-sm">{t('planner.q.group_size')}
              <input type="number" min={1} max={50} value={form.group_size}
                onChange={(e) => set({ group_size: Number(e.target.value) })}
                className="ml-3 bg-night-900 border border-white/10 rounded-lg px-3 py-1 w-20" />
            </label>
          </>
        )}
        {step === 'style' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.q.style')}</h2>
            <Toggle value={form.style} options={STYLES as any} onChange={(v) => set({ style: v })} />
            <label className="flex items-center gap-2 mt-4 text-sm">
              <input type="checkbox" checked={form.accept_long_route}
                onChange={(e) => set({ accept_long_route: e.target.checked })} />
              {t('planner.long_route')}
            </label>
          </>
        )}
        {step === 'review' && (
          <>
            <h2 className="font-display text-3xl">{t('planner.review_h')}</h2>
            <ul className="text-sm text-gold-400/80 space-y-1">
              <li>City: <strong>{form.city}</strong></li>
              <li>Intent: <strong>{form.intent}</strong></li>
              <li>Vibes: <strong>{form.vibe_tags.join(', ') || 'any'}</strong></li>
              <li>Budget: <strong>€{form.budget_per_person}/pp ({form.budget_band})</strong></li>
              <li>Group: <strong>{form.group_type} × {form.group_size}</strong></li>
              <li>Style: <strong>{form.style}</strong></li>
            </ul>
            {error && <p className="text-accent-500 text-sm">{error}</p>}
          </>
        )}

        <div className="flex justify-between pt-4">
          <button onClick={prev} disabled={stepIdx === 0} className="btn btn-ghost disabled:opacity-30">{t('planner.back')}</button>
          {step !== 'review' ? (
            <button onClick={next} className="btn btn-primary">{t('planner.next')}</button>
          ) : (
            <button onClick={submit} disabled={submitting} className="btn btn-primary">
              {submitting ? t('planner.submitting') : t('planner.submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
