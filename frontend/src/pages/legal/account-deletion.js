import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

// Public page (no auth, no login wall). Submits to the deletion-request
// endpoint that emails the admin + a confirmation back to the requester.
// Google Play + App Store require this URL to be reachable by people
// who have already uninstalled the app and therefore can't log in.

const PROD_API = process.env.NEXT_PUBLIC_API_URL || "https://api.savorymind.net";

function apiBaseUrl() {
  if (typeof window === "undefined") return PROD_API;
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? "/backend" : PROD_API;
}

export default function AccountDeletion() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`${apiBaseUrl()}/api/account/delete-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMsg("Too many requests from this network. Try again in an hour, or email privacy@savorymind.net directly.");
        } else {
          setErrorMsg("Something went wrong. Please email privacy@savorymind.net and we'll handle it manually.");
        }
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please email privacy@savorymind.net and we'll handle it manually.");
      setStatus("error");
    }
  }

  return (
    <>
      <Head>
        <title>Delete your SavoryMind account</title>
        <meta name="description" content="Request deletion of your SavoryMind account and associated data." />
      </Head>
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Home</Link>

          <h1 className="text-3xl font-bold mt-6 mb-2">Delete your account</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: 11 May 2026</p>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900">What this does</h2>
              <p>
                This page lets you request permanent deletion of your SavoryMind account and
                associated data. You don't need to be logged in — just enter the email address
                you used to sign up.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">What gets deleted</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Your account record (email, password hash, social-login IDs)</li>
                <li>Your profile data (display name, bio, preferences, location)</li>
                <li>Your content (reviews, menu items, bookings, inventory entries, food journal)</li>
                <li>Your authentication sessions (refresh tokens)</li>
                <li>Connected service tokens (Spotify, etc.)</li>
                <li>Diagnostic event logs keyed to your user ID</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">What we keep, and why</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Anonymised aggregate analytics</strong> — once your account is deleted,
                  any product-usage events tied to your ID are stripped of the link to you and
                  retained only as anonymous counts. This data cannot be re-associated with you.
                </li>
                <li>
                  <strong>Records we're legally required to keep</strong> — if any of your
                  activity is subject to a regulatory hold (e.g. financial transaction logs in
                  jurisdictions that require multi-year retention), we keep the minimum required
                  for the legally mandated period and delete it the moment we're allowed to.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">How long it takes</h2>
              <p>
                We process deletion requests within <strong>30 days</strong>. You'll receive an
                email confirmation when the request is received and another when deletion is
                complete. If you change your mind, reply to either email within 30 days and we'll
                cancel the request.
              </p>
            </section>

            <section className="border border-gray-200 rounded-lg p-6 mt-8 not-prose bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Request deletion</h2>

              {status === "success" ? (
                <div className="bg-green-50 border border-green-200 rounded p-4 text-green-800">
                  <p className="font-semibold">Request received.</p>
                  <p className="text-sm mt-2">
                    We've sent a confirmation to <strong>{email}</strong>. We'll process the
                    deletion within 30 days and email you when it's complete.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email address on the account *
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={status === "submitting"}
                    />
                  </div>
                  <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for leaving (optional)
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Helps us improve. Not required."
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={status === "submitting"}
                    />
                  </div>
                  {errorMsg && (
                    <p className="text-sm text-red-600">{errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "submitting" || !email}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition"
                  >
                    {status === "submitting" ? "Submitting…" : "Request account deletion"}
                  </button>
                  <p className="text-xs text-gray-500">
                    Prefer email? Send a deletion request to{" "}
                    <a href="mailto:privacy@savorymind.net" className="text-blue-600">privacy@savorymind.net</a>.
                  </p>
                </form>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">Questions</h2>
              <p>
                See our <Link href="/legal/privacy" className="text-blue-600">privacy policy</Link>{" "}
                for full detail on what we collect, or email{" "}
                <a href="mailto:privacy@savorymind.net" className="text-blue-600">privacy@savorymind.net</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
