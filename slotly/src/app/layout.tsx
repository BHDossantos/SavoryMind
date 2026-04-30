import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Slotly — Tell us what you want. We book it.",
  description: "Your personal assistant for real-world bookings in Rome.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-ink/10 bg-cream/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              Slotly
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              {session ? (
                <>
                  <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
                  <Link href="/bookings" className="btn btn-secondary">My bookings</Link>
                  {session.role === "admin" && (
                    <Link href="/admin" className="btn btn-secondary">Admin</Link>
                  )}
                  <form action="/api/auth/logout" method="post">
                    <button className="btn btn-secondary" type="submit">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary">Log in</Link>
                  <Link href="/signup" className="btn btn-primary">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-10 text-xs text-ink/50">
          Slotly is a booking facilitator. Bookings depend on business confirmation.
        </footer>
      </body>
    </html>
  );
}
