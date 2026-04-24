import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

const TIMES = ["12:00","12:30","13:00","13:30","14:00","18:00","18:30","19:00","19:30","20:00","20:30","21:00"];

export default function BookTable() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ restaurant_name: "", booking_date: "", booking_time: "19:00", party_size: 2, special_requests: "" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadBookings = () => {
    api.getDinerBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false));
  };

  useEffect(() => { loadBookings(); }, []);

  // Pre-fill restaurant name when navigated from discover page
  useEffect(() => {
    if (router.isReady && router.query.restaurant) {
      setForm((f) => ({ ...f, restaurant_name: decodeURIComponent(router.query.restaurant) }));
    }
  }, [router.isReady, router.query.restaurant]);

  const handleChange = (e) => {
    const val = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.restaurant_name.trim()) { setError("Restaurant name is required."); return; }
    if (!form.booking_date) { setError("Please choose a date."); return; }
    setLoading(true); setError(null);
    try {
      await api.createDinerBooking(form);
      setSuccess(`Booking confirmed at ${form.restaurant_name}!`);
      setForm({ restaurant_name: "", booking_date: "", booking_time: "19:00", party_size: 2, special_requests: "" });
      loadBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (id) => {
    setConfirmDialog({
      message: "Cancel this booking? This cannot be undone.",
      confirmLabel: "Cancel Booking",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.cancelDinerBooking(id);
          loadBookings();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const upcoming = bookings.filter((b) => b.status === "confirmed");
  const past = bookings.filter((b) => b.status !== "confirmed");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">📅 Book a Table</h1>
        <p className="text-gray-400 mt-1">Reserve your next dining experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Booking form */}
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-5">New Reservation</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {success && <div className="mb-4 p-3 bg-diner-50 border border-diner-200 rounded-lg text-sm text-diner-700">✓ {success}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Restaurant Name *</label>
              <input
                name="restaurant_name" value={form.restaurant_name} onChange={handleChange}
                placeholder="The Blue Plate"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Date *</label>
                <input
                  type="date" name="booking_date" value={form.booking_date} onChange={handleChange}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Time</label>
                <select name="booking_time" value={form.booking_time} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400">
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Party Size</label>
              <input
                type="number" name="party_size" value={form.party_size} onChange={handleChange}
                min={1} max={20}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Special Requests</label>
              <textarea
                name="special_requests" value={form.special_requests} onChange={handleChange}
                rows={2} placeholder="Allergies, occasion, seating preference..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Booking..." : "Confirm Booking"}
            </button>
          </form>
        </div>

        {/* Booking list */}
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-diner-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Upcoming ({upcoming.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {upcoming.map((b) => (
                  <div key={b.id} className="px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{b.restaurant_name}</p>
                        <p className="text-sm text-gray-500">{b.booking_date} · {b.booking_time} · {b.party_size} guests</p>
                        {b.special_requests && <p className="text-xs text-gray-400 mt-1 italic">{b.special_requests}</p>}
                      </div>
                      <button onClick={() => handleCancel(b.id)} className="text-xs text-red-500 hover:underline ml-3 mt-0.5">Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden opacity-70">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-600 text-sm">Past Bookings</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {past.map((b) => (
                  <div key={b.id} className="px-5 py-3">
                    <p className="font-medium text-gray-700 text-sm">{b.restaurant_name}</p>
                    <p className="text-xs text-gray-400">{b.booking_date} · <span className="capitalize">{b.status}</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!fetching && bookings.length === 0 && (
            <div className="bg-diner-50 rounded-2xl border border-diner-100 p-8 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-diner-700 font-medium">No bookings yet</p>
              <p className="text-diner-500 text-sm mt-1">Make your first reservation above</p>
            </div>
          )}
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
