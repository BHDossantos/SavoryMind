import Head from "next/head";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service — SavoryMind</title>
        <meta name="description" content="Terms governing use of SavoryMind." />
      </Head>
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Home</Link>

          <h1 className="text-3xl font-bold mt-6 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: 7 May 2026</p>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-6">

            <section>
              <h2 className="text-xl font-semibold text-gray-900">1. Agreement</h2>
              <p>
                By creating an account or using SavoryMind ("the service") via the web app at
                savorymind.net or the mobile app, you agree to these Terms of Service. If you don't
                agree, please don't use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">2. Who can use the service</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must be 13 or older.</li>
                <li>If you're using SavoryMind on behalf of a business (typically a restaurant), you
                  represent that you have authority to bind that business to these terms.</li>
                <li>You're responsible for keeping your password (or social-login credentials) secret
                  and for all activity under your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">3. Your content</h2>
              <p>
                You own the reviews, menu items, photos, inventory data, and other content you add
                ("Your Content"). You grant us a worldwide, non-exclusive, royalty-free license to
                store, process, and display Your Content as needed to operate and improve the service
                — for example, displaying your reviews on your dashboard, processing menu items
                through AI to generate insights, and showing aggregated trends to restaurants.
              </p>
              <p className="mt-3">
                We don't claim ownership of Your Content. You can delete it at any time via the app;
                deletion removes it from our active systems within 30 days (allowing for backup
                rotation).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">4. AI-generated content</h2>
              <p>
                SavoryMind uses Anthropic's Claude AI to generate recommendations, marketing insights,
                training plans, and other AI features. AI output is automatically generated, may
                contain errors, and is not a substitute for professional advice (legal, medical,
                regulatory, business). Don't make critical business decisions based solely on AI
                output without human review.
              </p>
              <p className="mt-3">
                We make best efforts to ensure AI features are useful and accurate, but we make no
                warranty that AI output will be correct, complete, or appropriate for any specific
                situation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">5. Acceptable use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the service for any illegal purpose.</li>
                <li>Submit false reviews, fake bookings, or fabricated inventory data.</li>
                <li>Attempt to gain unauthorized access to other accounts, restaurants' data, or
                  our infrastructure.</li>
                <li>Reverse engineer, decompile, or attempt to extract source code from the service
                  beyond what's permitted by law.</li>
                <li>Submit content that is defamatory, harassing, infringes others' intellectual
                  property, or contains malicious code.</li>
                <li>Use automated tools (scrapers, bots) to access the service except via our public
                  APIs and within rate limits.</li>
                <li>Resell, sublicense, or redistribute the service without our written permission.</li>
              </ul>
              <p className="mt-3">
                We may suspend or terminate accounts that violate these rules. We try to give notice
                first when reasonable.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">6. Connected services</h2>
              <p>
                Optional integrations (Spotify, Google sign-in, Apple sign-in) are subject to those
                providers' terms. We're not responsible for changes to their APIs that may degrade
                or disable connected features.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">7. Pricing</h2>
              <p>
                SavoryMind is currently free to use. If we introduce paid tiers in the future, we'll
                give existing users at least 30 days notice before any feature you currently have
                access to becomes paid-only, and we'll grandfather existing functionality for active
                users where reasonable.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">8. Termination</h2>
              <p>
                You can delete your account at any time by emailing
                <a href="mailto:privacy@savorymind.net" className="text-blue-600 ml-1">privacy@savorymind.net</a>.
                We may terminate or suspend accounts that materially violate these terms, with notice
                where reasonable. On termination, sections 3 (your content rights), 9 (warranty),
                10 (liability), 12 (governing law) survive.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">9. Warranty disclaimer</h2>
              <p>
                The service is provided <strong>"as is"</strong> and <strong>"as available"</strong>.
                To the maximum extent permitted by law, we disclaim all warranties — express or
                implied — including merchantability, fitness for a particular purpose, and
                non-infringement. We don't warrant that the service will be uninterrupted, error-free,
                or that AI-generated content will be accurate.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">10. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, SavoryMind and its operators are not liable
                for indirect, incidental, special, consequential, or punitive damages, or for lost
                profits, lost revenue, lost data, or business interruption — even if we were advised
                of the possibility. Our aggregate liability for any claim arising from these terms
                or your use of the service is limited to USD $100 or what you paid us in the 12
                months prior, whichever is greater.
              </p>
              <p className="mt-3">
                Some jurisdictions don't allow limitation of liability for consumer claims; in that
                case the above applies only to the extent allowed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">11. Changes to these terms</h2>
              <p>
                We may update these terms periodically. The "Last updated" date at the top reflects
                the most recent revision. Material changes will be communicated via in-app notification
                or email. Continued use of the service after changes take effect constitutes
                acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">12. Governing law</h2>
              <p>
                These terms are governed by the laws of the jurisdiction where SavoryMind is
                operated. Disputes will be resolved in that jurisdiction's courts. If any provision
                of these terms is held unenforceable, the remaining provisions remain in effect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">13. Contact</h2>
              <p>
                Questions about these terms? Email
                <a href="mailto:hello@savorymind.net" className="text-blue-600 ml-1">hello@savorymind.net</a>.
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
