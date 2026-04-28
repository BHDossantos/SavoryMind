import Link from 'next/link';
import { CITIES, INTENTS, VIBES } from '../../../shared/constants/options';
import { TrendingVenues } from '@/components/home/TrendingVenues';
import { HiddenGems } from '@/components/home/HiddenGems';
import { NearMe } from '@/components/home/NearMe';

const QUICK_INTENTS = [
  { value: 'date_night',   label: 'Date Night',     blurb: 'Romantic dinner + sexy cocktail bar' },
  { value: 'vip_table',    label: 'VIP Table',      blurb: 'Bottle service, guest list, late' },
  { value: 'dinner_drinks',label: 'Dinner + Drinks',blurb: 'Curated 2-stop night' },
  { value: 'dancing',      label: 'Clubs Tonight',  blurb: 'Best dance floors right now' },
  { value: 'aperitivo',    label: 'Aperitivo',      blurb: 'Pre-dinner drinks like a local' },
  { value: 'live_music',   label: 'Live Music',     blurb: 'Jazz, blues, soul tonight' },
  { value: 'meet_people',  label: 'Meet People',    blurb: 'Singles-friendly bars + clubs' },
  { value: 'budget',       label: 'Budget Night',   blurb: 'Great vibe under €50' },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="text-center">
        <p className="label">Your night, curated</p>
        <h1 className="font-display text-6xl md:text-7xl mt-3 leading-tight">
          Where should we go <em className="text-gold-400">tonight?</em>
        </h1>
        <p className="mt-4 text-lg text-gold-400/70 max-w-2xl mx-auto">
          Tell us your vibe, your budget, and who you're with. Nocturna plans the perfect
          dinner → bar → club night and books it for you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/plan/new" className="btn btn-primary">Plan my night</Link>
          <Link href="/chat" className="btn btn-secondary">Ask the concierge</Link>
          <Link href="/groups/new" className="btn btn-secondary">Plan with friends</Link>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          {CITIES.map((c) => (
            <Link key={c.slug} href={`/plan/new?city=${c.slug}`} className="chip">{c.label}</Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl mb-4">What's your night?</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_INTENTS.map((q) => (
            <Link key={q.value} href={`/plan/new?intent=${q.value}`} className="card hover:border-gold-500/40 transition">
              <div className="text-gold-400 font-medium">{q.label}</div>
              <div className="text-sm text-gold-400/60 mt-1">{q.blurb}</div>
            </Link>
          ))}
        </div>
      </section>

      <NearMe />

      <section>
        <h2 className="font-display text-3xl mb-4">Trending venues</h2>
        <TrendingVenues />
      </section>

      <section>
        <h2 className="font-display text-3xl mb-4">Hidden gems</h2>
        <HiddenGems />
      </section>

      <section className="card">
        <p className="label">Why Nocturna</p>
        <h2 className="font-display text-3xl mt-2">Three plans, not fifty.</h2>
        <p className="mt-3 text-gold-400/70 max-w-3xl">
          Skip the endless searching. Nocturna picks 1–3 plans tailored to your vibe, books
          your dinner, gets you on the guest list, and even arranges VIP tables — all in seconds.
        </p>
      </section>
    </div>
  );
}
