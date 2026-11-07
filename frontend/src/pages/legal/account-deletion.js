import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

// Public page (no auth, no login wall). Submits to the deletion-request
// endpoint that saves an unverified request and emails a one-time confirmation.
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

  const [verificationToken, setVerificationToken] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("idle");
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (token) {
      setVerificationToken(token);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function confirmVerification(e) {
    e.preventDefault();
    if (verificationStatus === "submitting") return;
    setVerificationStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBaseUrl()}/api/account/delete-request/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      });
      if (!res.ok) throw new Error("Verification failed");
      setVerificationToken("");
      setVerificationStatus("success");
    } catch {
      setVerificationStatus("error");
      setErrorMsg("This link could not be verified. It may be expired or already used. You can request a new link from the deletion page.");
    }
  }

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
          setErrorMsg("The verification email could not be sent. Please retry later or use the signed-in deletion option.");
        }
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please retry later or use the signed-in deletion option.");
      setStatus("error");
    }
  }

  if (verificationToken || verificationStatus === "success") return (
    <main className="max-w-xl mx-auto p-8">
      <Head><title>Confirm deletion request — SavoryMind</title></Head>
      <h1 className="text-2xl font-semibold">Confirm your deletion request</h1>
      {verificationStatus === "success" ? <p>Your verified request is saved for review. This does not confirm completed deletion or cancel a subscription.</p> :
        <form onSubmit={confirmVerification}>
          <p>Confirm that you requested permanent account deletion. This verifies your email address and places the request in the review queue. Opening this page alone does not submit confirmation.</p>
          <button type="submit" disabled={verificationStatus === "submitting"}>{verificationStatus === "submitting" ? "Confirming…" : "Confirm deletion request"}</button>
          {!!errorMsg && <p role="alert">{errorMsg}</p>}
        </form>}
      <Link href="/legal/account-deletion">Back to deletion requests</Link>
    </main>
  );

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
          <p className="text-sm text-gray-500 mb-8">Last updated: 3 November 2026</p>

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
              <h2 className="text-xl font-semibold text-gray-900">Data covered by your request</h2>
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
              <h2 className="text-xl font-semibold text-gray-900">Retention review</h2>
              <p>Your request requires a review of linked records, connected services,
                backups and any applicable retention obligations. The request acknowledgment
                does not confirm that data has been erased or anonymised. Ask about the scope
                and status of your request using its reference number.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">After you submit</h2>
              <p>
                Submitting this form sends a request for review. An acknowledgment does not
                confirm completed deletion or a processing deadline. To ask about the request
                or withdraw it before deletion, contact privacy@savorymind.net. Withdrawal is
                not confirmed until you receive a response.
              </p>
            </section>

            <section className="border border-gray-200 rounded-lg p-6 mt-8 not-prose bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Request deletion</h2>

              {status === "success" ? (
                <div className="bg-green-50 border border-green-200 rounded p-4 text-green-800">
                  <p className="font-semibold">Request received.</p>
                  <p className="text-sm mt-2">
                    Check <strong>{email}</strong> for the verification step. Your request is saved, but it is not actionable until verified. Your account has not been deleted.
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
