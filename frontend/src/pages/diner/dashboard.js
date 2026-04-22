import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

export default function DinerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDinerSummary(), api.getDinerBookings(), api.getDinerVisits()])
      .then(([s, b, v]) => { setSummary(s); setBookings(b); setVisits(v); })
      .finally(() => setLoading(false));
  }, []);

  const upcoming = bookings.filter((b) => b.status === "confirmed").slice(0, 3);
  const recent = visits.slice(0, 3);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.display_name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-400 mt-1">Your personal dining companion</p>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
            <p className="text-2xl">🍽️</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_visits}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Visits</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
            <p className="text-2xl">⭐</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_overall || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">Avg Rating</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
            <p className="text-2xl">🔁</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.return_rate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Return Rate</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
            <p className="text-2xl">📅</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_bookings}</p>
            <p className="text-xs text-gray-400 mt-0.5">Bookings Made</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming bookings */}
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">📅 Upcoming Bookings</h2>
            <Link href="/diner/book" className="text-xs text-diner-600 font-medium hover:underline">+ Book</Link>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-gray-400">Loading...</p>
          ) : upcoming.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-400 text-sm mb-3">No upcoming bookings</p>
              <Link href="/diner/book" className="inline-flex bg-diner-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-diner-600">
                Book a table
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {upcoming.map((b) => (
                <div key={b.id} className="px-5 py-4">
                  <p className="font-semibold text-gray-900">{b.restaurant_name}</p>
                  <p className="text-sm text-gray-500">{b.booking_date} at {b.booking_time} · {b.party_size} guests</p>
                  {b.special_requests && <p className="text-xs text-gray-400 mt-1 italic">{b.special_requests}</p>}
                  <span className="inline-block mt-1 text-xs bg-diner-100 text-diner-700 px-2 py-0.5 rounded-full">{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent visits */}
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">📖 Recent Visits</h2>
            <Link href="/diner/history" className="text-xs text-diner-600 font-medium hover:underline">All visits</Link>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-gray-400">Loading...</p>
          ) : recent.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-400 text-sm mb-3">No visits logged yet</p>
              <Link href="/diner/history" className="inline-flex bg-diner-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-diner-600">
                Log a visit
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recent.map((v) => (
                <div key={v.id} className="px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{v.restaurant_name}</p>
                      <p className="text-xs text-gray-400">{v.visit_date}</p>
                    </div>
                    <span className="text-amber-500 text-sm">{stars(v.overall_rating)}</span>
                  </div>
                  {v.items_ordered && <p className="text-xs text-gray-500 mt-1 truncate">{v.items_ordered}</p>}
                  {v.highlights && <p className="text-xs text-diner-600 mt-1 italic">❤️ {v.highlights}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top restaurants */}
      {summary?.top_restaurants?.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-diner-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">🏆 Your Top Spots</h2>
          <div className="flex flex-wrap gap-3">
            {summary.top_restaurants.map((r) => (
              <div key={r.name} className="flex items-center gap-2 bg-diner-50 border border-diner-100 rounded-xl px-4 py-2">
                <span className="text-lg">🍽️</span>
                <div>
                  <p className="text-sm font-semibold text-diner-900">{r.name}</p>
                  <p className="text-xs text-diner-600">{r.visits} visit{r.visits !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
