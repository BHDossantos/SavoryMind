import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import usePolling from "../../hooks/usePolling";
import ConfirmDialog from "../../components/ConfirmDialog";

const STATUS_STYLES = {
  confirmed: "bg-green-100 text-green-700",
  pending:   "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
  declined:  "bg-red-100 text-red-600",
};
const STATUS_KEY = {
  confirmed: "bookDinerPage.statusConfirmed",
  pending:   "bookDinerPage.statusPending",
  cancelled: "bookDinerPage.statusCancelled",
  declined:  "bookDinerPage.statusDeclined",
};

const today = () => new Date().toISOString().split("T")[0];

export default function BookTable() {
  const { t } = useTranslation();
  const router = useRouter();

  const linkedId   = router.isReady ? (router.query.restaurant_id || "") : "";
  const linkedName = router.isReady ? decodeURIComponent(router.query.restaurant_name || router.query.restaurant || "") : "";

  const [bookings, setBookings]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewedIds, setReviewedIds] = useState(new Set());

  useEffect(() => {
    api.getMyDinerReviews().then((rs) => setReviewedIds(new Set(rs.map((r) => r.booking_id)))).catch(() => {});
  }, []);

  const [restaurantId, setRestaurantId]     = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [selectedDate, setSelectedDate]     = useState(today());
  const [selectedTime, setSelectedTime]     = useState("");
  const [partySize, setPartySize]           = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");

  const [slots, setSlots]             = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const loadBookings = () => {
    api.getDinerBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false));
  };

  useEffect(() => { loadBookings(); }, []);

  // While a booking is pending the restaurant's decision, poll for status
  // updates so the diner sees "pending → confirmed/declined" without having
  // to refresh. Stops automatically once nothing is pending.
  const hasPending = bookings.some((b) => b.status === "pending");
  usePolling(
    () => api.getDinerBookings().then(setBookings).catch(() => {}),
    { intervalMs: 5000, enabled: hasPending },
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (linkedId)   setRestaurantId(linkedId);
    if (linkedName) setRestaurantName(linkedName);
  }, [router.isReady, linkedId, linkedName]);

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
    if (!restaurantName.trim()) { setError(t("bookDinerPage.errName")); return; }
    if (!selectedDate) { setError(t("bookDinerPage.errDate")); return; }
    if (restaurantId && !selectedTime) { setError(t("bookDinerPage.errSlot")); return; }
    setLoading(true); setError(null);

    try {
      if (restaurantId) {
        const booking = await api.requestBooking({
          restaurant_id: Number(restaurantId),
          booking_date: selectedDate,
          booking_time: selectedTime,
          party_size: partySize,
          special_requests: specialRequests,
        });
        setSuccess(t(
          booking?.status === "confirmed"
            ? "bookDinerPage.successConfirmed"
            : "bookDinerPage.successRequest",
          { name: restaurantName },
        ));
      } else {
        await api.createDinerBooking({
          restaurant_name: restaurantName,
          booking_date: selectedDate,
          booking_time: selectedTime || "19:00",
          party_size: partySize,
          special_requests: specialRequests,
        });
        setSuccess(t("bookDinerPage.successRecorded", { name: restaurantName }));
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
      message: t("bookDinerPage.cancelConfirm"),
      confirmLabel: t("bookDinerPage.cancelConfirmLabel"),
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
        <h1 className="text-2xl font-bold text-gray-900">{t("bookDinerPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("bookDinerPage.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-1">{t("bookDinerPage.newReservation")}</h2>
          {isLinked && (
            <p className="text-xs text-green-600 font-medium mb-4 flex items-center gap-1">
              {t("bookDinerPage.linkedNote")}
            </p>
          )}
          {error   && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {success && <div className="mb-4 p-3 bg-diner-50 border border-diner-200 rounded-lg text-sm text-diner-700">✓ {success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookDinerPage.restaurant")}</label>
              <div className="relative">
                <input value={restaurantName}
                  onChange={(e) => {
                    setRestaurantName(e.target.value);
                    if (!e.target.value) { setRestaurantId(""); setSlots([]); }
                  }}
                  placeholder={t("bookDinerPage.restaurantPh")}
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
                  {t("bookDinerPage.orFind")}{" "}
                  <button type="button" onClick={() => router.push("/diner/discover")}
                    className="text-diner-600 underline">{t("bookDinerPage.findRegistered")}</button>
                  {" "}{t("bookDinerPage.forRealtime")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookDinerPage.date")}</label>
                <input type="date" value={selectedDate} min={today()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookDinerPage.partySize")}</label>
                <input type="number" value={partySize} min={1} max={20}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                {t("bookDinerPage.time")} {isLinked && <span className="text-amber-600 font-normal">{t("bookDinerPage.selectSlot")}</span>}
              </label>
              {isLinked ? (
                slotsLoading ? (
                  <p className="text-xs text-gray-400 py-2 animate-pulse">{t("bookDinerPage.checking")}</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                    {t("bookDinerPage.noSlots")}
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
                        {s.time} <span className="text-xs opacity-60">{t("bookDinerPage.slotLeft", { n: s.remaining_covers })}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400">
                  {["12:00","12:30","13:00","13:30","14:00","18:00","18:30","19:00","19:30","20:00","20:30","21:00"].map((tm) => (
                    <option key={tm} value={tm}>{tm}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookDinerPage.specialRequests")}</label>
              <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                rows={2} placeholder={t("bookDinerPage.specialPh")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none"
              />
            </div>

            <button type="submit" disabled={loading || (isLinked && slotsLoading)}
              className="w-full bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
              {loading ? t("bookDinerPage.sending") : t("bookDinerPage.confirmBooking")}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-diner-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">{t("bookDinerPage.upcoming", { n: upcoming.length })}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {upcoming.map((b) => (
                  <div key={b.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{b.restaurant_name}</p>
                        <p className="text-sm text-gray-500">{b.booking_date} · {b.booking_time} · {t("bookDinerPage.guests", { n: b.party_size })}</p>
                        {b.special_requests && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{b.special_requests}</p>}
                        <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status] || ""}`}>
                          {STATUS_KEY[b.status] ? t(STATUS_KEY[b.status]) : b.status}
                        </span>
                      </div>
                      {(b.status === "confirmed" || b.status === "pending") && (
                        <button onClick={() => handleCancel(b.id)}
                          className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">{t("bookDinerPage.cancelBooking")}</button>
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
                <h3 className="font-semibold text-gray-600 text-sm">{t("bookDinerPage.past")}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {past.map((b) => (
                  <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-700 text-sm">{b.restaurant_name}</p>
                      <p className="text-xs text-gray-400">{b.booking_date} · <span>{STATUS_KEY[b.status] ? t(STATUS_KEY[b.status]) : b.status}</span></p>
                    </div>
                    {b.status === "confirmed" && b.restaurant_user_id && !reviewedIds.has(b.id) && (
                      <button
                        onClick={() => setReviewTarget({ booking_id: b.id, restaurant_user_id: b.restaurant_user_id, restaurant_name: b.restaurant_name })}
                        className="text-xs font-medium text-diner-600 hover:text-diner-800 flex-shrink-0 border border-diner-200 px-2.5 py-1 rounded-lg hover:bg-diner-50 transition-colors">
                        {t("bookDinerPage.reviewBtn")}
                      </button>
                    )}
                    {b.status === "confirmed" && b.restaurant_user_id && reviewedIds.has(b.id) && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{t("bookDinerPage.reviewed")}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!fetching && bookings.length === 0 && (
            <div className="bg-diner-50 rounded-2xl border border-diner-100 p-8 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-diner-700 font-medium">{t("bookDinerPage.noBookings")}</p>
              <p className="text-diner-500 text-sm mt-1">{t("bookDinerPage.noBookingsSub")}</p>
            </div>
          )}
        </div>
      </div>

      {reviewTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-1">{t("bookDinerPage.leaveReview")}</h2>
            <p className="text-sm text-gray-500 mb-5">{reviewTarget.restaurant_name}</p>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 mb-2 block">{t("bookDinerPage.rating")}</label>
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
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t("bookDinerPage.commentOpt")}</label>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                rows={3} placeholder={t("bookDinerPage.commentPh")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={submitReview} disabled={reviewSaving}
                className="flex-1 bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60 transition-colors">
                {reviewSaving ? t("bookDinerPage.submitting") : t("bookDinerPage.submitReview")}
              </button>
              <button onClick={() => setReviewTarget(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">
                {t("bookDinerPage.modalCancel")}
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
