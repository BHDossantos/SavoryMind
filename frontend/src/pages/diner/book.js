import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

const STATUS_STYLES = {
  confirmed: "bg-green-100 text-green-700",
  pending:   "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
  declined:  "bg-red-100 text-red-600",
};
const STATUS_LABELS = {
  confirmed: "✅ Confirmed",
  pending:   "⏳ Awaiting confirmation",
  cancelled: "❌ Cancelled",
  declined:  "✗ Declined",
};

const today = () => new Date().toISOString().split("T")[0];

export default function BookTable() {
  const router = useRouter();

  // Pre-fill from query params (discover page passes restaurant_id + restaurant_name)
  const linkedId   = router.isReady ? (router.query.restaurant_id || "") : "";
  const linkedName = router.isReady ? decodeURIComponent(router.query.restaurant_name || router.query.restaurant || "") : "";

  const [bookings, setBookings]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Review state
  const [reviewTarget, setReviewTarget] = useState(null); // {booking_id, restaurant_user_id, restaurant_name}
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewedIds, setReviewedIds] = useState(new Set());

  useEffect(() => {
    api.getMyDinerReviews().then((rs) => setReviewedIds(new Set(rs.map((r) => r.booking_id)))).catch(() => {});
  }, []);

  // Form state
  const [restaurantId, setRestaurantId]     = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [selectedDate, setSelectedDate]     = useState(today());
  const [selectedTime, setSelectedTime]     = useState("");
  const [partySize, setPartySize]           = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");

  // Availability state
  const [slots, setSlots]             = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const loadBookings = () => {
    api.getDinerBookings().then(setBookings).finally(() => setFetching(false));
  };

  useEffect(() => { loadBookings(); }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (linkedId)   setRestaurantId(linkedId);
    if (linkedName) setRestaurantName(linkedName);
  }, [router.isReady, linkedId, linkedName]);

  // Fetch availability whenever restaurant or date changes
  useEffect(() => {
    if (!restaurantId || !selectedDate) { setSlots([]); return; }
    setSlotsLoading(true);
    api.getAvailability(restaurantId, selectedDate)
      .then((data) => { setSlots(data.slots || []); setSelectedTime(""); })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [restaurantId, selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!restaurantName.trim()) { setError("Restaurant name is required."); return; }
    if (!selectedDate) { setError("Please choose a date."); return; }
    if (restaurantId && !selectedTime) { setError("Please select an available time slot."); return; }
    setLoading(true); setError(null);

    try {
      if (restaurantId) {
        await api.requestBooking({
          restaurant_id: Number(restaurantId),
          booking_date: selectedDate,
          booking_time: selectedTime,
          party_size: partySize,
          special_requests: specialRequests,
        });
        setSuccess(`Booking request sent to ${restaurantName}! You'll be confirmed shortly.`);
      } else {
        await api.createDinerBooking({
          restaurant_name: restaurantName,
          booking_date: selectedDate,
          booking_time: selectedTime || "19:00",
          party_size: partySize,
          special_requests: specialRequests,
        });
        setSuccess(`Booking recorded at ${restaurantName}!`);
      }
      setRestaurantName(""); setRestaurantId(""); setSelectedDate(today());
      setSelectedTime(""); setPartySize(2); setSpecialRequests(""); setSlots([]);
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
        await api.cancelDinerBooking(id);
        loadBookings();
      },
    });
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    setReviewSaving(true);
    try {
      await api.createDinerReview({
        restaurant_user_id: reviewTarget.restaurant_user_id,
        booking_id: reviewTarget.booking_id,
        rating: reviewRating,
        comment: reviewComment || null,
      });
      setReviewedIds((prev) => new Set([...prev, reviewTarget.booking_id]));
      setReviewTarget(null);
      setReviewComment("");
      setReviewRating(5);
    } catch {}
    finally { setReviewSaving(false); }
  };

  const upcoming = bookings.filter((b) => b.status === "confirmed" || b.status === "pending");
  const past     = bookings.filter((b) => b.status !== "confirmed" && b.status !== "pending");
  const isLinked = Boolean(restaurantId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">📅 Book a Table</h1>
        <p className="text-gray-400 mt-1">Reserve your next dining experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Booking form */}
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-1">New Reservation</h2>
          {isLinked && (
            <p className="text-xs text-green-600 font-medium mb-4 flex items-center gap-1">
              ✅ SavoryMind restaurant — request goes straight to their dashboard
            </p>
          )}
          {error   && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {success && <div className="mb-4 p-3 bg-diner-50 border border-diner-200 rounded-lg text-sm text-diner-700">✓ {success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Restaurant *</label>
              <div className="relative">
                <input value={restaurantName}
                  onChange={(e) => {
                    setRestaurantName(e.target.value);
                    if (!e.target.value) { setRestaurantId(""); setSlots([]); }
                  }}
                  placeholder="Restaurant name"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 ${
                    isLinked ? "border-green-300 bg-green-50 pr-8" : "border-gray-200"
                  }`}
                />
                {isLinked && (
                  <button type="button" onClick={() => { setRestaurantId(""); setRestaurantName(""); setSlots([]); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>
              {!isLinked && (
                <p className="text-xs text-gray-400 mt-1">
                  Or{" "}
                  <button type="button" onClick={() => router.push("/diner/discover")}
                    className="text-diner-600 underline">find a registered restaurant</button>
                  {" "}for real-time availability
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Date *</label>
                <input type="date" value={selectedDate} min={today()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Party Size</label>
                <input type="number" value={partySize} min={1} max={20}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Time {isLinked && <span className="text-amber-600 font-normal">(select available slot)</span>}
              </label>
              {isLinked ? (
                slotsLoading ? (
                  <p className="text-xs text-gray-400 py-2 animate-pulse">Checking availability…</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                    No available slots on this date — try another day.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button key={s.time} type="button" onClick={() => setSelectedTime(s.time)}
                        className={`text-sm px-4 py-2 rounded-xl border font-medium transition-all ${
                          selectedTime === s.time
                            ? "bg-diner-600 text-white border-diner-600"
                            : "bg-white text-gray-700 border-gray-200 hover:border-diner-400"
                        }`}>
                        {s.time} <span className="text-xs opacity-60">{s.remaining_covers} left</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400">
                  {["12:00","12:30","13:00","13:30","14:00","18:00","18:30","19:00","19:30","20:00","20:30","21:00"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Special Requests</label>
              <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                rows={2} placeholder="Allergies, occasion, seating preference…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none"
              />
            </div>

            <button type="submit" disabled={loading || (isLinked && slotsLoading)}
              className="w-full bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
              {loading ? "Sending…" : isLinked ? "Send Booking Request" : "Confirm Booking"}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{b.restaurant_name}</p>
                        <p className="text-sm text-gray-500">{b.booking_date} · {b.booking_time} · {b.party_size} guests</p>
                        {b.special_requests && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{b.special_requests}</p>}
                        <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status] || ""}`}>
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                      </div>
                      {(b.status === "confirmed" || b.status === "pending") && (
                        <button onClick={() => handleCancel(b.id)}
                          className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">Cancel</button>
                      )}
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
                  <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-700 text-sm">{b.restaurant_name}</p>
                      <p className="text-xs text-gray-400">{b.booking_date} · <span className="capitalize">{b.status}</span></p>
                    </div>
                    {b.status === "confirmed" && b.restaurant_user_id && !reviewedIds.has(b.id) && (
                      <button
                        onClick={() => setReviewTarget({ booking_id: b.id, restaurant_user_id: b.restaurant_user_id, restaurant_name: b.restaurant_name })}
                        className="text-xs font-medium text-diner-600 hover:text-diner-800 flex-shrink-0 border border-diner-200 px-2.5 py-1 rounded-lg hover:bg-diner-50 transition-colors">
                        ⭐ Review
                      </button>
                    )}
                    {b.status === "confirmed" && b.restaurant_user_id && reviewedIds.has(b.id) && (
                      <span className="text-xs text-gray-400 flex-shrink-0">✓ Reviewed</span>
                    )}
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

      {reviewTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-1">Leave a Review</h2>
            <p className="text-sm text-gray-500 mb-5">{reviewTarget.restaurant_name}</p>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 mb-2 block">Rating</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map((star) => (
                  <button key={star} type="button" onClick={() => setReviewRating(star)}
                    className={`text-2xl transition-transform hover:scale-110 ${star <= reviewRating ? "opacity-100" : "opacity-30"}`}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-700 mb-1 block">Comment (optional)</label>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                rows={3} placeholder="What did you think?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={submitReview} disabled={reviewSaving}
                className="flex-1 bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
                {reviewSaving ? "Submitting…" : "Submit Review"}
              </button>
              <button onClick={() => setReviewTarget(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
