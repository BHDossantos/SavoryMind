import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import usePolling from "../../hooks/usePolling";
import { playChime } from "../../utils/chime";
import ConfirmDialog from "../../components/ConfirmDialog";

function ShareLinkWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user?.slug) return null;

  const base = (typeof window !== "undefined" ? window.location.origin : "https://savorymind.net");
  const link = `${base}/r/${user.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / Safari without permission — best effort
    }
  };

  return (
    <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
      <p className="text-sm font-semibold text-brand-900 mb-1">
        🔗 {t("bookingsPage.shareLinkHeadline")}
      </p>
      <p className="text-xs text-brand-700 mb-2">{t("bookingsPage.shareLinkSubtitle")}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 text-xs bg-white border border-brand-200 rounded-lg px-3 py-2 text-gray-700 font-mono truncate">
          {link}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 text-xs px-3 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700"
        >
          {copied ? t("bookingsPage.shareCopied") : t("bookingsPage.shareCopy")}
        </button>
      </div>
    </div>
  );
}

function SmsAlertWidget() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [editing, setEditing] = useState(!user?.phone);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    const trimmed = phone.trim();
    // Loose client-side check — Twilio enforces E.164 server-side. Empty
    // clears the phone (opt-out).
    if (trimmed && !/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      setErr(t("bookingsPage.smsPhoneInvalid"));
      return;
    }
    setSaving(true); setErr(null);
    try {
      await api.updateProfile({ phone: trimmed || null });
      updateUser({ phone: trimmed || null });
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing && user?.phone) {
    return (
      <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
        <span className="text-green-800">
          📱 {t("bookingsPage.smsAlertsActive", { phone: user.phone })}
        </span>
        <button onClick={() => setEditing(true)} className="text-green-700 underline text-xs font-medium">
          {t("bookingsPage.smsChange")}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
      <p className="text-sm font-semibold text-brand-900 mb-1">{t("bookingsPage.smsHeadline")}</p>
      <p className="text-xs text-brand-700 mb-2">{t("bookingsPage.smsSubtitle")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+15555550100"
          className="flex-1 min-w-[180px] border border-brand-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-4 py-1.5 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? t("common.saving") : t("bookingsPage.smsEnable")}
        </button>
        {user?.phone && (
          <button
            onClick={() => { setPhone(user.phone); setEditing(false); setErr(null); }}
            className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}

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
  const { t } = useTranslation();
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

  // Poll silently while the bookings page is open so new arrivals and
  // status changes (e.g. a diner cancelling, a pending request from the
  // public flow) show up without the restaurant having to refresh.
  usePolling(
    () => Promise.all([
      api.getBookings(filterDate || undefined),
      api.getTodaySummary(),
    ])
      .then(([b, s]) => { setBookings(b); setSummary(s); })
      .catch(() => {}),
    { intervalMs: 10000, enabled: true },
  );

  // Detect newly-arrived bookings vs the previous tick — chime + toast
  // so a restaurant operator doesn't have to keep eyes on the page. The
  // first render skips (prevIdsRef empty) so we don't fire for every
  // already-known booking on mount.
  const prevIdsRef = useRef(null);
  const [realtimeMsg, setRealtimeMsg] = useState(null);
  useEffect(() => {
    if (prevIdsRef.current === null) {
      prevIdsRef.current = new Set(bookings.map((b) => b.id));
      return;
    }
    const prev = prevIdsRef.current;
    const newOne = bookings.find((b) => !prev.has(b.id));
    if (newOne) {
      playChime();
      setRealtimeMsg(t("bookingsPage.realtimeNew", {
        name: newOne.customer_name || t("bookingsPage.realtimeGuest"),
        party: newOne.party_size,
      }));
    }
    prevIdsRef.current = new Set(bookings.map((b) => b.id));
  }, [bookings, t]);
  useEffect(() => {
    if (!realtimeMsg) return;
    const timer = setTimeout(() => setRealtimeMsg(null), 5500);
    return () => clearTimeout(timer);
  }, [realtimeMsg]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { setError(t("bookingsPage.customerRequired")); return; }
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
      message: t("bookingsPage.deletePrompt"),
      confirmLabel: t("bookingsPage.delete"),
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await api.deleteBooking(id); fetchAll(); }
        catch (err) { setError(err.message || t("bookingsPage.deleteFailed")); }
      },
    });
  };

  const handleConfirm = async (id) => {
    try { await api.confirmBooking(id); fetchAll(); }
    catch (err) { setError(err.message || t("bookingsPage.confirmFailed")); }
  };

  const handleDecline = async (id) => {
    try { await api.declineBooking(id); fetchAll(); }
    catch (err) { setError(err.message || t("bookingsPage.declineFailed")); }
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
    } catch (err) { setAvailError(err.message || t("bookingsPage.saveAvailFailed")); }
    finally { setAvailSaving(false); }
  };

  const onlineRequests = bookings.filter((b) => b.source === "online" && b.status === "pending");
  const regularBookings = bookings.filter((b) => !(b.source === "online" && b.status === "pending"));

  return (
    <div>
      {realtimeMsg && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white bg-brand-600"
        >
          {realtimeMsg}
        </div>
      )}
      <ShareLinkWidget />
      <SmsAlertWidget />
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("bookingsPage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("bookingsPage.subtitle")}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowAvail(true); loadAvailability(); }}
            className="border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">
            {t("bookingsPage.availabilityBtn")}
          </button>
          <button onClick={() => setShowForm(true)}
            className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors">
            {t("bookingsPage.newBooking")}
          </button>
        </div>
      </div>

      {/* Today summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: t("bookingsPage.todayBookings"), value: summary.total_bookings, icon: "📅" },
            { label: t("bookingsPage.confirmed"),     value: summary.confirmed,      icon: "✅" },
            { label: t("bookingsPage.totalCovers"),   value: summary.total_covers,   icon: "👥" },
            { label: t("bookingsPage.cancelled"),     value: summary.cancelled,      icon: "❌" },
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
              <h2 className="font-semibold text-amber-900">{t("bookingsPage.onlineRequests")}</h2>
              <p className="text-xs text-amber-700 mt-0.5">{t("bookingsPage.onlineRequestsSub")}</p>
            </div>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{onlineRequests.length}</span>
          </div>
          <div className="divide-y divide-amber-100">
            {onlineRequests.map((b) => (
              <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{b.customer_name}</p>
                  <p className="text-sm text-gray-600">{b.date} · {b.time_slot} · {t("bookingsPage.guests", { count: b.party_size })}</p>
                  {b.notes && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{b.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleConfirm(b.id)}
                    className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
                    {t("bookingsPage.confirmBtn")}
                  </button>
                  <button onClick={() => handleDecline(b.id)}
                    className="text-sm font-semibold bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors">
                    {t("bookingsPage.declineBtn")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4 mb-5">
        <label className="text-sm font-medium text-gray-700">{t("bookingsPage.dateFilter")}</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button onClick={() => setFilterDate("")} className="text-xs text-gray-400 hover:text-gray-700">{t("bookingsPage.showAll")}</button>
      </div>

      {/* Bookings table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("bookingsPage.colCustomer")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("bookingsPage.colDateTime")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("bookingsPage.colParty")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("bookingsPage.colTable")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("bookingsPage.colStatus")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">{t("bookingsPage.loading")}</td></tr>
            ) : regularBookings.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">{t("bookingsPage.noBookings")}</td></tr>
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
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{t("bookingsPage.onlineBadge")}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{b.date}</p>
                  <p className="text-xs text-gray-400">{b.time_slot}</p>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{t("bookingsPage.pax", { n: b.party_size })}</td>
                <td className="px-4 py-3 text-gray-600">{b.table_number ? `T${b.table_number}` : "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={b.status}
                    onChange={(e) => updateStatus(b.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-none cursor-pointer ${STATUS_STYLES[b.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    <option value="pending">{t("bookingsPage.statusPending")}</option>
                    <option value="confirmed">{t("bookingsPage.statusConfirmed")}</option>
                    <option value="seated">{t("bookingsPage.statusSeated")}</option>
                    <option value="completed">{t("bookingsPage.statusCompleted")}</option>
                    <option value="cancelled">{t("bookingsPage.statusCancelled")}</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(b.id)} className="text-xs text-red-500 hover:text-red-700">{t("bookingsPage.delete")}</button>
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
            <h2 className="font-bold text-gray-900 text-lg mb-4">{t("bookingsPage.newModalTitle")}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.customerName")}</label>
                  <input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.phone")}</label>
                  <input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.date")}</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.time")}</label>
                  <input value={form.time_slot} onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))} placeholder="19:00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.partySize")}</label>
                  <input type="number" min="1" value={form.party_size} onChange={(e) => setForm((f) => ({ ...f, party_size: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.tableNum")}</label>
                  <input type="number" value={form.table_number} onChange={(e) => setForm((f) => ({ ...f, table_number: e.target.value }))} placeholder={t("bookingsPage.tableOptional")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookingsPage.notes")}</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("bookingsPage.notesPlaceholder")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60 transition-colors">
                  {saving ? t("bookingsPage.saving") : t("bookingsPage.createBooking")}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">{t("bookingsPage.cancel")}</button>
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
              <h2 className="font-bold text-gray-900 text-lg">{t("bookingsPage.availModalTitle")}</h2>
              <button onClick={() => setShowAvail(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-5">{t("bookingsPage.availIntro")}</p>

            {availLoading ? (
              <p className="text-center text-gray-400 py-4">{t("bookingsPage.savingDots")}</p>
            ) : (
              <>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-gray-700 mb-3 block uppercase tracking-wider">{t("bookingsPage.availSlotsLabel")}</label>
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
                  <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase tracking-wider">{t("bookingsPage.bookingWindowLabel")}</label>
                  <input type="number" value={bookingWindow} min={1} max={365}
                    onChange={(e) => setBookingWindow(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t("bookingsPage.bookingWindowHint", { days: bookingWindow })}</p>
                </div>

                {availSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    {t("bookingsPage.availSaved")}
                  </div>
                )}
                {availError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{availError}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={saveAvailability} disabled={availSaving}
                    className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60 transition-colors">
                    {availSaving ? t("bookingsPage.savingDots") : t("bookingsPage.saveSettings")}
                  </button>
                  <button onClick={() => setShowAvail(false)}
                    className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">{t("bookingsPage.cancel")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
