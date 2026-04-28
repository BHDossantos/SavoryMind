'use client';
import Link from 'next/link';
import { CITIES } from '../../../../shared/constants/options';
import { TrendingVenues } from '@/components/home/TrendingVenues';
import { HiddenGems } from '@/components/home/HiddenGems';
import { NearMe } from '@/components/home/NearMe';
import { useT } from '@/lib/i18n';

const QUICK_INTENTS = [
  'date_night', 'vip_table', 'dinner_drinks', 'dancing',
  'aperitivo', 'live_music', 'meet_people', 'budget',
] as const;

export default function HomeClient() {
  const { t } = useT();
  return (
    <div className="space-y-16">
      <section className="text-center">
        <p className="label">{t('home.kicker')}</p>
        <h1 className="font-display text-6xl md:text-7xl mt-3 leading-tight">
          {t('home.headline')}
        </h1>
        <p className="mt-4 text-lg text-gold-400/70 max-w-2xl mx-auto">{t('home.sub')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/plan/new" className="btn btn-primary">{t('home.cta_plan')}</Link>
          <Link href="/chat" className="btn btn-secondary">{t('home.cta_chat')}</Link>
          <Link href="/groups/new" className="btn btn-secondary">{t('home.cta_group')}</Link>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          {CITIES.map((c) => (
            <Link key={c.slug} href={`/plan/new?city=${c.slug}`} className="chip">{c.label}</Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl mb-4">{t('home.section_what')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_INTENTS.map((q) => (
            <Link key={q} href={`/plan/new?intent=${q}`} className="card hover:border-gold-500/40 transition">
              <div className="text-gold-400 font-medium">{t(`quick.${q}.label`)}</div>
              <div className="text-sm text-gold-400/60 mt-1">{t(`quick.${q}.sub`)}</div>
            </Link>
          ))}
        </div>
      </section>

      <NearMe />

      <section>
        <h2 className="font-display text-3xl mb-4">{t('home.section_trending')}</h2>
        <TrendingVenues />
      </section>

      <section>
        <h2 className="font-display text-3xl mb-4">{t('home.section_gems')}</h2>
        <HiddenGems />
      </section>

      <section className="card">
        <p className="label">{t('home.why_kicker')}</p>
        <h2 className="font-display text-3xl mt-2">{t('home.why_headline')}</h2>
        <p className="mt-3 text-gold-400/70 max-w-3xl">{t('home.why_sub')}</p>
      </section>
    </div>
  );
}
