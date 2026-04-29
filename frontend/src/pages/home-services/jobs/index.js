// Customer's job inbox: open requests, quoted, booked, completed.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../services/api";

const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-800",
  quoted: "bg-sky-100 text-sky-800",
  booked: "bg-emerald-100 text-emerald-800",
  completed: "bg-gray-200 text-gray-700",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-500",
};

export default function MyJobs() {
  const [jobs, setJobs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.listMyHomeJobs(), api.listMyHomeBookings()])
      .then(([j, b]) => {
        setJobs(j || []);
        setBookings(b || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/home-services" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="font-bold">AvailableNow Home</span>
          </Link>
          <Link
            href="/home-services/request"
            className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            New request
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">My jobs</h1>
        <p className="mt-2 text-gray-600">Track every request and booking in one place.</p>

        {error && <div className="mt-6 text-sm text-red-600">{error}</div>}
        {loading ? (
          <div className="mt-10 text-gray-500">Loading…</div>
        ) : (
          <>
            <Section title="Active requests">
              {jobs.length === 0 ? (
                <Empty cta="Submit your first request" href="/home-services/request" />
              ) : (
                <div className="space-y-3">
                  {jobs.map((j) => (
                    <Link key={j.id} href={`/home-services/jobs/${j.id}`} className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-900">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="font-semibold">{j.title}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {j.category} · {j.urgency} · {j.city || "no city"}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_BADGE[j.status] || "bg-gray-100"}`}>
                          {j.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Bookings">
              {bookings.length === 0 ? (
                <div className="text-sm text-gray-500">No confirmed bookings yet.</div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="font-semibold">Booking #{b.id}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {b.scheduled_start ? new Date(b.scheduled_start).toLocaleString() : "Time TBD"} ·{" "}
                            {b.final_price} {b.currency} · {b.payment_status}
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-100 text-emerald-800">
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ cta, href }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
      <div className="text-gray-500 mb-3">Nothing here yet.</div>
      <Link href={href} className="inline-block bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-gray-800">
        {cta}
      </Link>
    </div>
  );
}
