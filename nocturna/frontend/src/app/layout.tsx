import type { Metadata } from 'next';
import '../styles/globals.css';
import { I18nProvider } from '@/lib/i18n';
import HeaderNav from '@/components/layout/HeaderNav';
import AnalyticsProvider from '@/components/layout/AnalyticsProvider';
import { SITE_URL, SITE_NAME } from '@/lib/api-server';

const description =
  'Plan your perfect night out in seconds — dinner → bar → club itineraries curated by vibe, budget, and location, with one-tap reservations and VIP tables in Rome, Milan, Barcelona, Paris, Lisbon, Miami, NY, Dubai, Mykonos, and Ibiza.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Plan your perfect night`,
    template: `%s | ${SITE_NAME}`,
  },
  description,
  applicationName: SITE_NAME,
  keywords: [
    'nightlife', 'date night', 'VIP table', 'cocktail bar', 'restaurant reservation',
    'Rome nightlife', 'Milan nightlife', 'Barcelona nightclub', 'speakeasy', 'rooftop bar',
    'Nocturna concierge',
  ],
  authors: [{ name: SITE_NAME }],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — Plan your perfect night`,
    description,
    locale: 'en_US',
    alternateLocale: ['it_IT'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Plan your perfect night`,
    description,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    description,
    sameAs: [],
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/plan/new?intent={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <I18nProvider>
          <AnalyticsProvider />
          <HeaderNav />
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
          <footer className="border-t border-white/5 mt-20 py-10 text-center text-xs text-gold-500/60">
            © {new Date().getFullYear()} {SITE_NAME} · Plan beautifully · Drink responsibly
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
