import Head from "next/head";
import Link from "next/link";

export default function Support() {
  return (
    <>
      <Head>
        <title>Support — SavoryMind</title>
        <meta name="description" content="Get help with SavoryMind — contact, FAQ, and known issues." />
      </Head>
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Home</Link>

          <h1 className="text-3xl font-bold mt-6 mb-2">Support</h1>
          <p className="text-sm text-gray-500 mb-10">
            Real humans behind every reply. We aim to respond within 1 business day.
          </p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The fastest path to a resolution is email. Include a screenshot or screen recording
              if you can — it usually tells us 80% of what we'd otherwise need to ask about.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-1">General help</p>
                <a
                  href="mailto:hello@savorymind.net"
                  className="text-blue-600 font-medium text-base hover:underline"
                >
                  hello@savorymind.net
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  Bug reports, feature requests, billing, anything else.
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-1">Privacy &amp; data requests</p>
                <a
                  href="mailto:privacy@savorymind.net"
                  className="text-blue-600 font-medium text-base hover:underline"
                >
                  privacy@savorymind.net
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  Data export, account deletion, GDPR/CCPA requests.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Common questions</h2>

            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900">I'm signed out unexpectedly. What happened?</p>
                <p className="text-sm text-gray-600 mt-1">
                  Sessions stay alive for 30 days as long as you use the app. If you cleared
                  cookies, signed in on another device, or logged out and back in, your previous
                  session was revoked for security. Just sign in again — your data is intact.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">My Spotify integration stopped working.</p>
                <p className="text-sm text-gray-600 mt-1">
                  Spotify access tokens expire and we refresh them automatically. If a refresh
                  fails (you revoked SavoryMind on spotify.com/account/apps, or Spotify rotated
                  the token), the connection is marked disconnected and you'll see a "Reconnect
                  Spotify" prompt on the Music page. One tap fixes it.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">I don't see AI recommendations / themes / pairings.</p>
                <p className="text-sm text-gray-600 mt-1">
                  AI features need our backend's Anthropic key to be configured. If a deploy
                  ever ships without it (or the key hits its quota), the app falls back to
                  rules-based recommendations rather than crashing — but the AI-specific panels
                  go quiet. If you're seeing this on the public version, email us — it's a bug
                  on our side, not yours.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">How do I delete my account?</p>
                <p className="text-sm text-gray-600 mt-1">
                  Email <a href="mailto:privacy@savorymind.net" className="text-blue-600">privacy@savorymind.net</a> from the address linked to your account.
                  We'll delete your data within 30 days (allowing for backup rotation) per the
                  privacy policy. We don't have a self-serve delete button yet — that's on the
                  roadmap.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Can I use SavoryMind for my restaurant?</p>
                <p className="text-sm text-gray-600 mt-1">
                  Yes — pick "Restaurant" during signup. You'll get menu management, sentiment
                  analysis, AI-powered marketing and training insights, inventory tracking with
                  weekly low-stock digest, and reports. Free during this phase.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Is the mobile app available?</p>
                <p className="text-sm text-gray-600 mt-1">
                  iOS and Android — we're rolling out to the App Store and Google Play. If
                  you're seeing this page from a device that can't find SavoryMind in the store
                  yet, the launch is in progress. Email us and we'll get you on the TestFlight
                  beta.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Status &amp; known issues</h2>
            <p className="text-gray-700 leading-relaxed">
              We don't run a public status page yet. If something's clearly broken across the
              app, mention it in your email and we'll respond with current status. Service
              availability is monitored via Sentry — most outages are caught and resolved
              within an hour.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Other links</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy →
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-blue-600 hover:underline">
                  Terms of Service →
                </Link>
              </li>
            </ul>
          </section>

        </div>
      </div>
    </>
  );
}
