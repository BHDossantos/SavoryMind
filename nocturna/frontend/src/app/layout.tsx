import type { Metadata } from 'next';
import '../styles/globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nocturna — Plan your perfect night',
  description: 'Curated nightlife plans, VIP tables, and bookings in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 backdrop-blur bg-night-950/70 border-b border-white/5">
          <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-2xl tracking-wide text-gold-400">Nocturna</span>
              <span className="text-xs uppercase tracking-[0.3em] text-gold-500/70">Night Concierge</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-gold-400/80">
              <Link href="/plan/new">Plan</Link>
              <Link href="/chat">Concierge</Link>
              <Link href="/groups/new">Group</Link>
              <Link href="/me/plans">My nights</Link>
              <Link href="/login" className="btn-secondary btn px-4 py-2">Sign in</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
        <footer className="border-t border-white/5 mt-20 py-10 text-center text-xs text-gold-500/60">
          © {new Date().getFullYear()} Nocturna · Plan beautifully · Drink responsibly
        </footer>
      </body>
    </html>
  );
}
