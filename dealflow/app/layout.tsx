import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Providers from "@/components/Providers";
import AuthMenu from "@/components/AuthMenu";
import PlanBadge from "@/components/PlanBadge";

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
        <Providers>
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
                <Link className="btn-ghost" href="/deals/new">
                  + New Deal
                </Link>
                <Link className="btn-ghost" href="/pricing">
                  Pricing
                </Link>
                <PlanBadge />
                <AuthMenu />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-slate-500">
            DealFlow AI · rule-based scoring + Claude Opus 4.7 narratives
          </footer>
        </Providers>
      </body>
    </html>
  );
}
