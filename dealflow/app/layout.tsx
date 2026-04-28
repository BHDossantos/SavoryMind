import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealFlow AI",
  description:
    "Find, analyze, score, negotiate and track small business acquisitions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">
                D
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">
                  DealFlow AI
                </div>
                <div className="text-[11px] text-slate-500">
                  Find · Analyze · Score · Negotiate · Track
                </div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link className="btn-ghost" href="/">
                Dashboard
              </Link>
              <Link className="btn-ghost" href="/pipeline">
                Pipeline
              </Link>
              <Link className="btn-ghost" href="/compare">
                Compare
              </Link>
              <Link className="btn-primary" href="/deals/new">
                + New Deal
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-slate-500">
          DealFlow AI · MVP build · rule-based scoring engine
        </footer>
      </body>
    </html>
  );
}
