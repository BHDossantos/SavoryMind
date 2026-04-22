import { useState, useEffect } from "react";
import { api } from "../../services/api";

const STATUS_STYLES = {
  confirmed: "bg-blue-100 text-blue-700",
  seated:    "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

const today = () => new Date().toISOString().split("T")[0];

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterDate, setFilterDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "", date: today(), time_slot: "19:00", party_size: 2, table_number: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.getBookings(filterDate || undefined),
      api.getTodaySummary(),
    ]).then(([b, s]) => { setBookings(b); setSummary(s); }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [filterDate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { setError("Customer name required."); return; }
    setSaving(true); setError(null);
    try {
      await api.createBooking({ ...form, party_size: Number(form.party_size), table_number: form.table_number ? Number(form.table_number) : null });
      setShowForm(false);
      fetchAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    await api.updateBooking(id, { status });
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this booking?")) return;
    await api.deleteBooking(id);
    fetchAll();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 Bookings</h1>
          <p className="text-gray-400 mt-1">Manage table reservations and covers</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors">
          + New Booking
        </button>
      </div>

      {/* Today summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Today's Bookings", value: summary.total_bookings, icon: "📅" },
            { label: "Confirmed", value: summary.confirmed, icon: "✅" },
            { label: "Total Covers", value: summary.total_covers, icon: "👥" },
            { label: "Cancelled", value: summary.cancelled, icon: "❌" },
          ].map((s) => (
            <div key={s.label} className="card">
              <div className="text-xl mb-1">{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4 mb-5">
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button onClick={() => setFilterDate("")} className="text-xs text-gray-400 hover:text-gray-700">Show all</button>
      </div>

      {/* Bookings table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date / Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Table</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No bookings for this date.</td></tr>
            ) : bookings.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{b.customer_name}</p>
                  <p className="text-xs text-gray-400">{b.customer_phone || b.customer_email || ""}</p>
                  {b.notes && <p className="text-xs text-amber-600 mt-0.5 truncate max-w-[160px]">⚠ {b.notes}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{b.date}</p>
                  <p className="text-xs text-gray-400">{b.time_slot}</p>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{b.party_size} pax</td>
                <td className="px-4 py-3 text-gray-600">{b.table_number ? `T${b.table_number}` : "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={b.status}
                    onChange={(e) => updateStatus(b.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-none cursor-pointer ${STATUS_STYLES[b.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="seated">Seated</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(b.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New booking modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-4">New Booking</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Customer name *</label>
                  <input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Phone</label>
                  <input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Time</label>
                  <input value={form.time_slot} onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))} placeholder="19:00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Party size</label>
                  <input type="number" min="1" value={form.party_size} onChange={(e) => setForm((f) => ({ ...f, party_size: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Table #</label>
                  <input type="number" value={form.table_number} onChange={(e) => setForm((f) => ({ ...f, table_number: e.target.value }))} placeholder="Optional"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notes / Dietary</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Allergies, special requests..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60 transition-colors">
                  {saving ? "Saving..." : "Create Booking"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
