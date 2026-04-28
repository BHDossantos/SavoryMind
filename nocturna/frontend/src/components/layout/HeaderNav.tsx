'use client';
import Link from 'next/link';
import { useT, LOCALES, type Locale } from '@/lib/i18n';

const LABELS: Record<Locale, string> = { en: 'EN', it: 'IT' };

export default function HeaderNav() {
  const { t, locale, setLocale } = useT();
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-night-950/70 border-b border-white/5">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-2xl tracking-wide text-gold-400">Nocturna</span>
          <span className="text-xs uppercase tracking-[0.3em] text-gold-500/70 hidden sm:inline">{t('nav.tagline')}</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-gold-400/80">
          <Link href="/plan/new" className="hidden sm:inline">{t('nav.plan')}</Link>
          <Link href="/chat" className="hidden sm:inline">{t('nav.concierge')}</Link>
          <Link href="/groups/new" className="hidden md:inline">{t('nav.group')}</Link>
          <Link href="/me/plans" className="hidden md:inline">{t('nav.my_nights')}</Link>
          <div className="flex border border-white/10 rounded-full overflow-hidden text-xs">
            {LOCALES.map((l) => (
              <button key={l} onClick={() => setLocale(l)}
                className={`px-2 py-1 ${locale === l ? 'bg-gold-500 text-night-950' : 'text-gold-400/70 hover:text-gold-400'}`}>
                {LABELS[l]}
              </button>
            ))}
          </div>
          <Link href="/login" className="btn-secondary btn px-4 py-2">{t('nav.sign_in')}</Link>
        </nav>
      </div>
    </header>
  );
}
