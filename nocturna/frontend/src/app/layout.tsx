import type { Metadata } from 'next';
import '../styles/globals.css';
import { I18nProvider } from '@/lib/i18n';
import HeaderNav from '@/components/layout/HeaderNav';
import AnalyticsProvider from '@/components/layout/AnalyticsProvider';

export const metadata: Metadata = {
  title: 'Nocturna — Plan your perfect night',
  description: 'Curated nightlife plans, VIP tables, and bookings in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <AnalyticsProvider />
          <HeaderNav />
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
          <footer className="border-t border-white/5 mt-20 py-10 text-center text-xs text-gold-500/60">
            © {new Date().getFullYear()} Nocturna · Plan beautifully · Drink responsibly
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
