import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/api-server';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Nocturna collects, uses, and protects your data.',
  alternates: { canonical: `${SITE_URL}/privacy` },
};

const EFFECTIVE_DATE = '23 September 2026';
const CONTACT_EMAIL = 'privacy@nocturna.app';

export default function PrivacyPolicy() {
  return (
    <article className="max-w-3xl mx-auto prose-invert space-y-6">
      <header>
        <p className="label">Legal</p>
        <h1 className="font-display text-4xl mt-2">Privacy Policy</h1>
        <p className="text-gold-400/60 text-sm mt-1">Effective: {EFFECTIVE_DATE}</p>
      </header>

      <Section title="Who we are">
        {SITE_NAME} (&quot;we&quot;, &quot;us&quot;) provides nightlife planning and
        reservation-request services through our website and mobile apps (the
        &quot;Service&quot;). This policy explains what personal data we collect, why,
        and the choices you have. Contact: {CONTACT_EMAIL}.
      </Section>

      <Section title="Data we collect">
        <ul className="list-disc list-inside space-y-1 text-gold-400/80">
          <li><strong>Account data</strong> — email, password (stored as a salted hash), and optionally your name and phone number.</li>
          <li><strong>Booking data</strong> — venue, date, time, group size, request type, budget, and any notes you add. Guest bookings include the contact name, phone, and email you provide.</li>
          <li><strong>Preferences</strong> — vibes, music, budget band, home city, saved venues, language.</li>
          <li><strong>Location</strong> — only when you grant permission, only while using the app, and only to rank venues by distance. We do not store your location server-side.</li>
          <li><strong>Payment data</strong> — handled by Stripe. We never see or store card numbers; we keep only the transaction reference, amount, and status.</li>
          <li><strong>Usage analytics</strong> — pseudonymous product events (pages viewed, plans generated, bookings submitted) via PostHog. No advertising trackers.</li>
          <li><strong>Feedback</strong> — ratings and comments you leave after a night out.</li>
        </ul>
      </Section>

      <Section title="Why we use it">
        To generate your night plans, transmit and confirm booking requests with
        venues, send you confirmations and reminders (email / SMS / push — using
        the contact details you provided), process payments you initiate,
        improve recommendations, and keep the Service secure (rate limiting,
        abuse prevention). We do <strong>not</strong> sell personal data and do
        not use it for third-party advertising.
      </Section>

      <Section title="Who we share it with">
        <ul className="list-disc list-inside space-y-1 text-gold-400/80">
          <li><strong>Venues</strong> — the details needed to fulfil your booking (name, group size, time, requests).</li>
          <li><strong>Processors</strong> — Stripe (payments), Twilio (SMS/WhatsApp), SendGrid (email), Expo (push), PostHog (analytics), Google Cloud (hosting, EU region where available), Mapbox (map tiles), Anthropic (AI concierge — your chat messages only, to generate replies).</li>
          <li><strong>Legal</strong> — if required by law or to protect the Service and its users.</li>
        </ul>
      </Section>

      <Section title="Retention">
        Account data is kept while your account exists. Booking records are kept
        for accounting purposes (anonymised after account deletion). Analytics
        events are pseudonymous and aged out per PostHog retention settings.
      </Section>

      <Section title="Your rights">
        You can access and update your profile in the app. You can{' '}
        <strong>delete your account</strong> at any time from Profile → Delete
        account (web and mobile); this permanently removes your account,
        preferences, and saved venues, and anonymises past bookings. EU/EEA
        residents additionally have GDPR rights to access, rectify, port,
        restrict, and object — email {CONTACT_EMAIL} and we will respond within
        30 days. You may also lodge a complaint with your local supervisory
        authority (in Italy: Garante per la protezione dei dati personali).
      </Section>

      <Section title="Children">
        The Service is intended for users aged 18+ (17+ per app-store rating,
        given references to venues that serve alcohol). We do not knowingly
        collect data from children.
      </Section>

      <Section title="Security">
        All traffic is encrypted in transit (HTTPS/TLS). Passwords are hashed
        with bcrypt. Access to production systems is restricted and logged.
      </Section>

      <Section title="Changes">
        We will post any material changes to this page and update the effective
        date. Continued use of the Service after changes constitutes acceptance.
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
