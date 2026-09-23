import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/api-server';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of Nocturna.',
  alternates: { canonical: `${SITE_URL}/terms` },
};

const EFFECTIVE_DATE = '23 September 2026';
const CONTACT_EMAIL = 'legal@nocturna.app';

export default function Terms() {
  return (
    <article className="max-w-3xl mx-auto space-y-6">
      <header>
        <p className="label">Legal</p>
        <h1 className="font-display text-4xl mt-2">Terms of Service</h1>
        <p className="text-gold-400/60 text-sm mt-1">Effective: {EFFECTIVE_DATE}</p>
      </header>

      <Section title="The Service">
        {SITE_NAME} curates nightlife itineraries and transmits reservation and
        VIP-table <strong>requests</strong> to venues on your behalf. Venues —
        not {SITE_NAME} — decide whether to accept a request. A booking is only
        final when marked <em>confirmed</em> in the app. Venue information
        (hours, prices, dress codes) is curated in good faith but can change
        without notice; verify critical details with the venue.
      </Section>

      <Section title="Eligibility & accounts">
        You must be 18 or older. Keep your credentials secure; you are
        responsible for activity under your account. You may delete your
        account at any time from Profile → Delete account.
      </Section>

      <Section title="Payments">
        Optional paid features (concierge fees, premium plans, subscriptions)
        are processed by Stripe under their terms. Prices are shown before you
        pay. Subscriptions renew monthly until cancelled. Fees for concierge
        services already rendered are non-refundable; contact {CONTACT_EMAIL}{' '}
        for anything that went wrong and we will make it right where we can.
        Purchases made inside the iOS or Android app may instead be processed
        by Apple or Google and are additionally subject to their store terms.
      </Section>

      <Section title="Acceptable use">
        No fraudulent bookings, no scraping, no attempts to disrupt the Service,
        no use that violates law or venue policies. We may suspend accounts
        that abuse the Service or its venues (e.g. repeated no-shows).
      </Section>

      <Section title="Content">
        Reviews and feedback you submit may be used (anonymised) to improve
        recommendations. Don&apos;t submit content that is unlawful, defamatory,
        or infringes others&apos; rights; we may remove such content.
      </Section>

      <Section title="Disclaimers">
        The Service is provided &quot;as is&quot;. To the maximum extent permitted by
        law, {SITE_NAME} is not liable for venue conduct, refused entry, venue
        closures, pricing discrepancies, or indirect damages. Our aggregate
        liability is limited to the amounts you paid us in the 12 months before
        the claim. Nothing here limits liability that cannot be limited by law,
        including mandatory consumer rights in your country of residence.
      </Section>

      <Section title="Drink responsibly">
        Nocturna plans nights that involve venues serving alcohol. Know your
        limits, never drive under the influence, and respect local laws.
      </Section>

      <Section title="Governing law">
        These terms are governed by the laws of Italy, without prejudice to
        mandatory consumer protections of your habitual residence. Disputes go
        to the competent court of Rome unless consumer law provides otherwise.
      </Section>

      <Section title="Changes & contact">
        We may update these terms; material changes will be announced in the
        app. Questions: {CONTACT_EMAIL}.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="font-display text-2xl text-gold-400">{title}</h2>
      <div className="mt-2 text-sm text-gold-400/80 leading-relaxed">{children}</div>
    </section>
  );
}
