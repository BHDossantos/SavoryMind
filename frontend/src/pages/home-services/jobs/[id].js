// Single job detail: shows the job, incoming quotes, and lets the customer
// accept one (which creates a booking).
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../services/api";

export default function JobDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [job, setJob] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [j, q] = await Promise.all([api.getMyHomeJob(id), api.listQuotesForMyJob(id)]);
      setJob(j);
      setQuotes(q || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function accept(quoteId) {
    setBusy(true);
    setError(null);
    try {
      await api.acceptHomeQuote(quoteId);
      router.push("/home-services/jobs");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancel this request?")) return;
    setBusy(true);
    try {
      await api.cancelMyHomeJob(id);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/home-services/jobs" className="text-sm text-gray-600 hover:text-gray-900">
            ← All jobs
          </Link>
          <Link href="/home-services" className="font-bold">
            🏠 AvailableNow Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {loading && <div className="text-gray-500">Loading…</div>}
        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
        {job && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{job.title}</h1>
                  <div className="mt-1 text-sm text-gray-500">
                    {job.category} · {job.urgency} · {job.booking_type}
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-800">{job.status}</span>
              </div>
              {job.description && <p className="mt-4 text-gray-700 whitespace-pre-line">{job.description}</p>}
              <div className="mt-4 text-sm text-gray-500">
                {job.city ? `${job.city}` : "Location not provided"}
                {job.preferred_start && ` · prefers ${new Date(job.preferred_start).toLocaleString()}`}
              </div>
              {job.status !== "completed" && job.status !== "cancelled" && (
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="mt-4 text-sm text-red-600 hover:underline"
                >
                  Cancel request
                </button>
              )}
            </div>

            <h2 className="text-lg font-semibold mt-10 mb-3">Quotes ({quotes.length})</h2>
            {quotes.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-gray-500">
                No quotes yet — pros usually respond within a few hours.
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-semibold">Provider #{q.provider_id}</div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {q.estimated_duration_minutes ? `${q.estimated_duration_minutes} min · ` : ""}
                          earliest {q.earliest_start ? new Date(q.earliest_start).toLocaleString() : "TBD"}
                        </div>
                        {q.notes && <p className="mt-2 text-sm text-gray-700">{q.notes}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {q.total_price} {q.currency}
                        </div>
                        <div className="text-xs text-gray-500">incl. platform fee</div>
                        <button
                          disabled={busy || q.status !== "submitted"}
                          onClick={() => accept(q.id)}
                          className="mt-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                        >
                          {q.status === "submitted" ? "Accept" : q.status}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
