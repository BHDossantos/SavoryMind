import Head from "next/head";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — SavoryMind</title>
        <meta name="description" content="How SavoryMind collects, uses, and protects your data." />
      </Head>
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Home</Link>

          <h1 className="text-3xl font-bold mt-6 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: 7 May 2026</p>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-6">

            <section>
              <h2 className="text-xl font-semibold text-gray-900">1. What this is</h2>
              <p>
                SavoryMind ("we", "us") is an AI-powered food intelligence platform serving home cooks,
                restaurant operators, and restaurant patrons. This page explains what data we collect,
                why, who we share it with, and what control you have over it. Our goal is plain English
                — if anything here is unclear, email <a href="mailto:privacy@savorymind.net" className="text-blue-600">privacy@savorymind.net</a> and we'll explain.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">2. What we collect</h2>

              <h3 className="text-base font-semibold mt-4">2a. Account data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Email address and password (passwords are stored hashed, not in plain text)</li>
                <li>Display name and account type (consumer / restaurant / diner / staff)</li>
                <li>Profile information you choose to add: bio, dietary preferences, cuisine
                  preferences, music genres, restaurant business type, etc.</li>
                <li>Restaurant location, timezone, and operating preferences (restaurant accounts only)</li>
              </ul>

              <h3 className="text-base font-semibold mt-4">2b. Authentication data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Refresh-token identifiers ("JTIs") used to keep you logged in across sessions</li>
                <li>If you sign in with Google or Apple: the Google/Apple-issued user ID and the email
                  + name they share with us. We never store your Google or Apple password.</li>
              </ul>

              <h3 className="text-base font-semibold mt-4">2c. Connected services (optional)</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Spotify:</strong> if you connect Spotify, we store an encrypted copy of your
                  Spotify access and refresh tokens (encrypted at rest with Fernet symmetric encryption)
                  so we can fetch your top artists and tracks for personalised wine and music
                  recommendations. Disconnect any time and we delete the tokens.</li>
              </ul>

              <h3 className="text-base font-semibold mt-4">2d. Content you create</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Reviews you write, menu items you create, bookings you make, inventory adjustments
                  you log, food journal entries, social connections.</li>
                <li>Photos, recipe notes, food preferences.</li>
              </ul>

              <h3 className="text-base font-semibold mt-4">2e. Diagnostic data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>When the app encounters an error, we log it via Sentry along with your user ID
                  and the API request that triggered it. We do not log your password, payment details,
                  or the full content of your Spotify tokens.</li>
                <li>We capture product-usage events via PostHog (e.g. when you sign up, log in, view
                  a recommendation, submit a review). Events are keyed on your user ID. Properties
                  are limited to safe metadata — account type, recommendation count, rating bucket
                  — never the content of what you wrote, your email, name, or any tokens.</li>
              </ul>

              <p className="mt-4">
                We do <strong>not</strong> collect: payment information (we don't sell SavoryMind today),
                precise GPS location (we use city/country only, and only if you set it in your profile),
                contacts, calendar, or anything from other apps on your device.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">3. How we use it</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Run the product:</strong> log you in, save your reviews, render your dashboard.</li>
                <li><strong>Personalisation:</strong> use your stated preferences and your Spotify
                  listening signal to make AI recommendations more relevant to you.</li>
                <li><strong>AI processing:</strong> we send the text of your reviews, menu items, and
                  product preferences to Anthropic (the company behind Claude AI) to extract themes,
                  generate recommendations, and produce restaurant-specific marketing and training
                  insights. Anthropic processes this data on our behalf and does not use it to train
                  their models. See section 4.</li>
                <li><strong>Notifications:</strong> we send you in-app notifications and (if email is
                  enabled) one weekly inventory low-stock digest if you're a restaurant operator.
                  You can disable these in your profile.</li>
                <li><strong>Service improvement:</strong> aggregated, non-personally-identifying
                  metrics help us understand which features are valuable. We do not sell or share this
                  data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">4. Who we share it with</h2>
              <p>
                We share data only with service providers who help us run the product, and only the
                minimum needed for them to do their job:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Anthropic</strong> (Claude AI) — receives review text, prompt context, and
                  preferences to generate AI insights. Bound by Anthropic's commercial agreement; does
                  not train on your data.</li>
                <li><strong>Spotify</strong> — only if you connect Spotify. We use your token to call
                  Spotify's API on your behalf; Spotify itself sees your usage of their API.</li>
                <li><strong>Google</strong> — verifies your Google ID token if you sign in with Google.
                  Receives no other data.</li>
                <li><strong>Apple</strong> — verifies your Apple ID token if you sign in with Apple.
                  Receives no other data.</li>
                <li><strong>Resend</strong> — sends transactional email (e.g. the weekly inventory
                  digest). Receives only the email address and the email body.</li>
                <li><strong>Sentry</strong> — receives crash and error reports including your user ID
                  and the failing request URL. Bound by Sentry's data processing agreement.</li>
                <li><strong>PostHog</strong> — receives product-analytics events keyed on your user ID
                  (e.g. signup_completed, login_completed, recommendation_served, review_submitted).
                  We never send PostHog passwords, tokens, raw email/name, review text, or any
                  free-text user content — only event names and a small set of safe properties
                  (account_type, rating bucket, recommendations_count). Used to understand product
                  usage so we can fix what's broken and build what you actually use.</li>
                <li><strong>Google Cloud Platform</strong> — hosts the backend (Cloud Run) and database
                  (Cloud SQL Postgres). Cloud SQL is encrypted at rest by Google.</li>
              </ul>
              <p className="mt-3">
                We do <strong>not</strong> sell your personal data. We do not share it with advertisers.
                We do not allow our service providers to use it for their own marketing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">5. How long we keep it</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account and content data: until you delete your account.</li>
                <li>Refresh tokens: 30 days from last use, then automatically expired.</li>
                <li>Revoked-token records: pruned after their natural expiry to keep the table bounded.</li>
                <li>Sentry error logs: 90 days, then automatically purged.</li>
                <li>PostHog product-usage events: 365 days (PostHog default), then automatically purged.</li>
                <li>Backups: up to 30 days for disaster recovery.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">6. Your rights</h2>
              <p>You can:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Access</strong> your data — visit your profile, or email
                  <a href="mailto:privacy@savorymind.net" className="text-blue-600 ml-1">privacy@savorymind.net</a> to
                  request a full export.</li>
                <li><strong>Modify</strong> profile data via the profile screen on web or mobile.</li>
                <li><strong>Disconnect</strong> Spotify and other connected services from your profile.</li>
                <li><strong>Delete</strong> your account by emailing
                  <a href="mailto:privacy@savorymind.net" className="text-blue-600 ml-1">privacy@savorymind.net</a> —
                  we'll delete account data within 30 days. Reviews and menu items associated with your
                  account are also deleted; aggregated, non-personally-identifying analytics may persist.</li>
              </ul>
              <p className="mt-3">
                If you're an EU/UK/California resident, you have additional rights under GDPR/CCPA
                including the right to data portability and to lodge a complaint with your local
                supervisory authority.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">7. Security</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>All traffic between your device and our backend is HTTPS-encrypted.</li>
                <li>Passwords are hashed with bcrypt before storage.</li>
                <li>Spotify OAuth tokens are encrypted at rest with Fernet symmetric encryption; raw
                  tokens never appear in our database in plaintext form.</li>
                <li>Refresh-token rotation with revocation tracking — a stolen-then-rotated session
                  cookie stops working after the legitimate user's next request.</li>
                <li>Authentication cookies use httpOnly + Secure + SameSite=Lax flags.</li>
                <li>We monitor for unusual error patterns via Sentry and rotate compromised credentials
                  promptly when suspected.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">8. Children</h2>
              <p>
                SavoryMind is not directed to children under 13 and we do not knowingly collect data
                from them. If you believe we've collected data from a child under 13, email us and
                we'll delete it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">9. Changes to this policy</h2>
              <p>
                We'll update the "Last updated" date at the top whenever we change this policy.
                Material changes will be communicated via in-app notification or email.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">10. Contact</h2>
              <p>
                Questions or requests? Email
                <a href="mailto:privacy@savorymind.net" className="text-blue-600 ml-1">privacy@savorymind.net</a>.
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
