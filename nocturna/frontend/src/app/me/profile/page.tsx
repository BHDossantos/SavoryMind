'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';
import { VerifyBanner } from '@/components/me/VerifyBanner';
import { CITIES, BUDGET_BANDS, STYLES } from '../../../../../shared/constants/options';

export default function Profile() {
  const { t } = useT();
  const router = useRouter();
  const logout = useAuth(s => s.logout);
  const [me, setMe] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { api.get('/api/auth/me').then(setMe).catch(() => setMe(null)); }, []);

  async function save() {
    await api.put('/api/auth/me', { name: me.name, phone: me.phone, lang: me.lang, home_city: me.home_city, prefs: me.prefs });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function deleteAccount() {
    const sure = window.confirm(
      'Delete your Nocturna account permanently? Saved venues and preferences are removed; past bookings are anonymised. This cannot be undone.',
    );
    if (!sure) return;
    setDeleting(true);
    try {
      await api.del('/api/auth/me');
      logout();
      router.push('/');
    } catch (e: any) {
      alert(e?.message || 'Could not delete account. Try again later.');
      setDeleting(false);
    }
  }

  if (!me) return <p className="text-gold-400/60">{t('profile.signin_required')}</p>;
  const prefs = me.prefs || {};

  return (
    <div className="max-w-xl mx-auto space-y-3">
      <VerifyBanner />
      <div className="card space-y-3">
      <h1 className="font-display text-3xl">{t('profile.h')}</h1>
      <input placeholder={t('profile.name')} value={me.name || ''} onChange={(e) => setMe({ ...me, name: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <input placeholder={t('profile.phone')} value={me.phone || ''} onChange={(e) => setMe({ ...me, phone: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2" />
      <select value={me.home_city} onChange={(e) => setMe({ ...me, home_city: e.target.value })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2">
        {CITIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <select value={prefs.budget_band || '50-100'}
        onChange={(e) => setMe({ ...me, prefs: { ...prefs, budget_band: e.target.value } })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2">
        {BUDGET_BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <select value={prefs.style || 'casual'}
        onChange={(e) => setMe({ ...me, prefs: { ...prefs, style: e.target.value } })}
        className="w-full bg-night-900 border border-white/10 rounded-lg px-3 py-2">
        {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={save} className="btn btn-primary">{t('common.save')}</button>
      {saved && <p className="text-gold-400">{t('common.saved')}</p>}
      </div>

      <div className="card !border-red-900/40">
        <h2 className="label !text-red-300">Danger zone</h2>
        <p className="text-xs text-gold-400/60 mt-1">
          Deleting removes your account, saved venues and preferences permanently.
          Past bookings are anonymised.
        </p>
        <button
          onClick={deleteAccount}
          disabled={deleting}
          className="mt-3 text-sm rounded-full px-4 py-2 bg-red-900/40 text-red-200 border border-red-700/40 hover:bg-red-800/60 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
    </div>
  );
}
