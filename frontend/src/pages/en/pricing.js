/**
 * /en/pricing — English mirror of /pricing. Copy hardcoded in the JSX.
 * JSON-LD: SoftwareApplication with the three EUR offers.
 */
import Head from "next/head";
import Link from "next/link";
import MarketingShell from "../../components/marketing/MarketingShell";
import PricingTiers, { TIERS } from "../../components/marketing/PricingTiers";

const FAQS = [
  {
    q: "How does the free 30-day trial work?",
    a: "You sign up, connect your data (or take the 15-minute guided audit) and use the full product for 30 days. No card required to start. If we don't find at least €500/month in recoverable losses, you pay nothing.",
  },
  {
    q: "What counts as a \"location\"?",
    a: "A venue with its own kitchen and its own staff. If you run several brands or several venues of the same brand, the Gruppo plan brings them together in a single dashboard with venue-by-venue comparison.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes, at any time. Upgrades take effect immediately; downgrades take effect from the next billing period.",
  },
  {
    q: "Can I cancel whenever I want?",
    a: "Yes, from the billing section, with no penalties, effective at the end of the period. With the annual plan you still get 2 months free compared to monthly.",
  },
  {
    q: "Is it compatible with my POS or management system?",
    a: "Yes. You can upload a sales export as CSV or Excel from any system, or start with zero data through the guided audit. Direct integrations with the POS systems most common in Italy are in development.",
  },
];

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SavoryMind",
  url: "https://savorymind.net/en/pricing",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "SavoryMind finds the money restaurants lose — waste, portioning, staff time — and generates personalized coaching plans to stop it.",
  offers: TIERS.map((t) => ({
    "@type": "Offer",
    name: t.name,
    price: String(t.monthly),
    priceCurrency: "EUR",
    url: "https://savorymind.net/en/pricing",
    category: "subscription",
  })),
};

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PricingEN() {
  return (
    <MarketingShell lang="en" altHref="/pricing">
      <Head>
        <title>Pricing — SavoryMind for restaurants | From €149/month</title>
        <meta
          name="description"
          content="Trattoria €149/month, Ristorante €299/month, Gruppo €599/month. 30-day free trial: if we don't find €500/month in losses, you don't pay."
        />
        <link rel="canonical" href="https://savorymind.net/en/pricing" />
        <link rel="alternate" hrefLang="it-IT" href="https://savorymind.net/pricing" />
        <link rel="alternate" hrefLang="en-US" href="https://savorymind.net/en/pricing" />
        <link rel="alternate" hrefLang="x-default" href="https://savorymind.net/pricing" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://savorymind.net/en/pricing" />
        <meta property="og:title" content="Pricing — SavoryMind for restaurants" />
        <meta
          property="og:description"
          content="Three clear plans, a 30-day free trial, and an honest guarantee: if we don't find €500/month in recoverable losses, you don't pay."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Pricing — SavoryMind for restaurants" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
        />
      </Head>

      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-14 pb-6 md:pt-20 md:pb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Pricing</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight max-w-3xl mx-auto">
            A clear price. A result in euros.
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-5">
            Every plan includes the 15-minute loss estimate and coaching plans for your staff.
            Choose by the size of your kitchen — and change whenever you like.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 md:pb-24 pt-6">
        <PricingTiers lang="en" />
      </section>

      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 md:py-20">
          <h2 className="font-serif text-3xl font-bold text-stone-900 text-center mb-10">
            Questions about the plans
          </h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group bg-white border border-stone-200 rounded-2xl px-6 py-5 open:shadow-md transition-shadow">
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none text-lg font-bold text-stone-900 leading-snug">
                  {f.q}
                  <span className="text-brand-600 text-xl leading-none mt-0.5 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="text-base text-stone-600 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="text-center text-base text-stone-500 mt-10">
            More questions?{" "}
            <Link href="/contatti" className="font-bold text-brand-700 hover:text-brand-600">
              Write to us — we reply the same day →
            </Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}

PricingEN.bareLayout = true;
