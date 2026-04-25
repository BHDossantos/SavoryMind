import { useState, useEffect } from "react";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

const STATUS_STYLES = {
  confirmed: "bg-blue-100 text-blue-700",
  pending:   "bg-amber-100 text-amber-700",
  seated:    "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
  declined:  "bg-red-100 text-red-600",
};

const ALL_SLOTS = ["12:00","12:30","13:00","13:30","14:00","18:00","18:30","19:00","19:30","20:00","20:30","21:00"];

const today = () => new Date().toISOString().split("T")[0];

export default function Bookings() {
  const [bookings, setBookings]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [filterDate, setFilterDate] = useState(today());
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm] = useState({
    customer_name: "", customer_email: "", customer_phone: "",
    date: today(), time_slot: "19:00", party_size: 2, table_number: "", notes: "",
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  // Availability settings
  const [showAvail, setShowAvail]             = useState(false);
  const [availSlots, setAvailSlots]           = useState([]);
  const [bookingWindow, setBookingWindow]     = useState(60);
  const [availLoading, setAvailLoading]       = useState(false);
  const [availSaving, setAvailSaving]         = useState(false);
  const [availSuccess, setAvailSuccess]       = useState(false);
  const [availError, setAvailError]           = useState(null);
  const [confirmDialog, setConfirmDialog]     = useState(null);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.getBookings(filterDate || undefined),
      api.getTodaySummary(),
    ]).then(([b, s]) => { setBookings(b); setSummary(s); }).finally(() => setLoading(false));
  };

  const loadAvailability = () => {
    setAvailLoading(true);
    api.getMyAvailability()
      .then((d) => { setAvailSlots(d.time_slots || []); setBookingWindow(d.booking_window_days || 60); })
      .catch(() => {})
      .finally(() => setAvailLoading(false));
  };

  useEffect(() => { fetchAll(); }, [filterDate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { setError("Customer name required."); return; }
    setSaving(true); setError(null);
    try {
      await api.createBooking({
        ...form,
        party_size: Number(form.party_size),
        table_number: form.table_number ? Number(form.table_number) : null,
      });
      setShowForm(false);
      fetchAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    await api.updateBooking(id, { status });
    fetchAll();
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      message: "Delete this booking? This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await api.deleteBooking(id); fetchAll(); }
        catch (err) { setError(err.message || "Failed to delete booking."); }
      },
    });
  };

  const handleConfirm = async (id) => {
    try { await api.confirmBooking(id); fetchAll(); }
    catch (err) { setError(err.message || "Failed to confirm booking."); }
  };

  const handleDecline = async (id) => {
    try { await api.declineBooking(id); fetchAll(); }
    catch (err) { setError(err.message || "Failed to decline booking."); }
  };

  const toggleSlot = (slot) => {
    setAvailSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort()
    );
  };

  const saveAvailability = async () => {
    setAvailSaving(true); setAvailError(null);
    try {
      await api.updateMyAvailability({ time_slots: availSlots, booking_window_days: Number(bookingWindow) });
      setAvailSuccess(true);
      setTimeout(() => setAvailSuccess(false), 3000);
    } catch (err) { setAvailError(err.message || "Failed to save availability."); }
    finally { setAvailSaving(false); }
  };

  const onlineRequests = bookings.filter((b) => b.source === "online" && b.status === "pending");
  const regularBookings = bookings.filter((b) => !(b.source === "online" && b.status === "pending"));

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 Bookings</h1>
          <p className="text-gray-400 mt-1">Manage table reservations and covers</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowAvail(true); loadAvailability(); }}
            className="border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">
            ⚙ Availability
          </button>
          <button onClick={() => setShowForm(true)}
            className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors">
            + New Booking
          </button>
        </div>
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

      {/* Online booking requests */}
      {onlineRequests.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-amber-900">🌐 Online Booking Requests</h2>
              <p className="text-xs text-amber-700 mt-0.5">Diners requesting tables via SavoryMind — confirm or decline</p>
            </div>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{onlineRequests.length}</span>
          </div>
          <div className="divide-y divide-amber-100">
            {onlineRequests.map((b) => (
              <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{b.customer_name}</p>
                  <p className="text-sm text-gray-600">{b.date} · {b.time_slot} · {b.party_size} guests</p>
                  {b.notes && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{b.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleConfirm(b.id)}
                    className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
                    ✓ Confirm
                  </button>
                  <button onClick={() => handleDecline(b.id)}
                    className="text-sm font-semibold bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors">
                    ✕ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
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
            ) : regularBookings.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No bookings for this date.</td></tr>
            ) : regularBookings.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{b.customer_name}</p>
                      <p className="text-xs text-gray-400">{b.customer_phone || b.customer_email || ""}</p>
                      {b.notes && <p className="text-xs text-amber-600 mt-0.5 truncate max-w-[160px]">⚠ {b.notes}</p>}
                    </div>
                    {b.source === "online" && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">🌐 Online</span>
                    )}
                  </div>
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
                    <option value="pending">Pending</option>
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

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

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
                <button type="submit" disabled={saving}
                  className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60 transition-colors">
                  {saving ? "Saving..." : "Create Booking"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Availability settings modal */}
      {showAvail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 text-lg">⚙ Online Availability Settings</h2>
              <button onClick={() => setShowAvail(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-5">Choose which time slots diners can request online. Only selected slots appear in the discovery page.</p>

            {availLoading ? (
              <p className="text-center text-gray-400 py-4">Loading…</p>
            ) : (
              <>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-gray-700 mb-3 block uppercase tracking-wider">Available Time Slots</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_SLOTS.map((slot) => (
                      <button key={slot} type="button" onClick={() => toggleSlot(slot)}
                        className={`text-sm py-2 rounded-xl border font-medium transition-all ${
                          availSlots.includes(slot)
                            ? "bg-brand-500 text-white border-brand-500"
                            : "bg-white text-gray-600 border-gray-200 hover:border-brand-400"
                        }`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase tracking-wider">Booking Window (days in advance)</label>
                  <input type="number" value={bookingWindow} min={1} max={365}
                    onChange={(e) => setBookingWindow(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">Diners can book up to {bookingWindow} days ahead</p>
                </div>

                {availSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    ✓ Availability settings saved
                  </div>
                )}
                {availError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{availError}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={saveAvailability} disabled={availSaving}
                    className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60 transition-colors">
                    {availSaving ? "Saving…" : "Save Settings"}
                  </button>
                  <button onClick={() => setShowAvail(false)}
                    className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
