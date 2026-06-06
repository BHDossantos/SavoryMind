/**
 * Public guest booking page — /r/[slug].
 *
 * What a restaurant shares with their existing diners over WhatsApp /
 * Instagram / their own newsletter. No signup required: name + phone is
 * enough. Italian-first (the pilot market), but i18n auto-detects browser
 * language so a French-speaking diner sees French.
 *
 * On submit the restaurant gets the live in-app notification + email +
 * (if opted in) SMS — same pipeline as the authenticated booking flow.
 */
import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// Localized date formatting — Italian/French/Spanish/Portuguese use DD/MM,
// English uses MM/DD. Pull from the active i18n locale.
function fmtDate(iso, locale) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  } catch { return iso; }
}

export default function GuestBookingPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const slug = router.isReady ? String(router.query.slug || "") : "";

  const [restaurant, setRestaurant] = useState(null);
  const [upcoming,   setUpcoming]   = useState([]);
  const [loadErr,    setLoadErr]    = useState(null);
  const [loading,    setLoading]    = useState(true);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize,    setPartySize]    = useState(2);
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [email,        setEmail]        = useState("");
  const [notes,        setNotes]        = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState(null);
  const [result,     setResult]     = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.getPublicRestaurant(slug)
      .then((data) => {
        setRestaurant(data.restaurant);
        setUpcoming(data.upcoming || []);
        const firstWithSlots = (data.upcoming || []).find((d) => d.slots && d.slots.length > 0);
        if (firstWithSlots) setSelectedDate(firstWithSlots.date);
      })
      .catch((err) => setLoadErr(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || !name.trim() || !phone.trim()) {
      setSubmitErr(t("guestBookingPage.errMissingFields"));
      return;
    }
    setSubmitting(true); setSubmitErr(null);
    try {
      const res = await api.createGuestBooking(slug, {
        booking_date:     selectedDate,
        booking_time:     selectedTime,
        party_size:       partySize,
        customer_name:    name.trim(),
        customer_phone:   phone.trim(),
        customer_email:   email.trim() || null,
        special_requests: notes.trim() || null,
      });
      setResult(res);
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDay = upcoming.find((d) => d.date === selectedDate);
  const cuisines = pj(restaurant?.cuisines, []).slice(0, 3);
  const langs = ["en", "it", "es", "pt", "fr"];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">{t("common.loading")}</p>
      </div>
    );
  }
  if (loadErr === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">🍽️</p>
          <h1 className="text-xl font-bold text-gray-900">{t("guestBookingPage.notFound")}</h1>
          <p className="text-sm text-gray-500 mt-2">{t("guestBookingPage.notFoundHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{restaurant?.restaurant_name || restaurant?.display_name} · SavoryMind</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Language switcher — diners coming from a restaurant's WhatsApp may
            not have the right browser locale; give them one tap to switch. */}
        <div className="max-w-xl mx-auto px-4 pt-4 flex justify-end gap-1">
          {langs.map((l) => (
            <button
              key={l}
              onClick={() => i18n.changeLanguage(l)}
              className={`text-xs px-2 py-1 rounded-md font-semibold ${
                i18n.language === l ? "bg-brand-600 text-white" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="max-w-xl mx-auto px-4 py-6">
          {/* Restaurant header */}
          <div className="text-center mb-8">
            <span className="text-4xl">🍽️</span>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-2">
              {restaurant?.restaurant_name || restaurant?.display_name}
            </h1>
            {(restaurant?.city || restaurant?.country) && (
              <p className="text-sm text-gray-500 mt-1">
                {[restaurant?.city, restaurant?.country].filter(Boolean).join(", ")}
              </p>
            )}
            {cuisines.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-3">
                {cuisines.map((c) => (
                  <span key={c} className="text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {result ? (
            <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-6 text-center">
              <p className="text-5xl mb-3">{result.status === "confirmed" ? "✅" : "📩"}</p>
              <h2 className="text-lg font-bold text-gray-900">
                {result.status === "confirmed"
                  ? t("guestBookingPage.confirmedTitle")
                  : t("guestBookingPage.pendingTitle")}
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                {result.status === "confirmed"
                  ? t("guestBookingPage.confirmedMsg", {
                      date: fmtDate(selectedDate, i18n.language),
                      time: selectedTime,
                      name: restaurant?.restaurant_name || restaurant?.display_name,
                    })
                  : t("guestBookingPage.pendingMsg", {
                      name: restaurant?.restaurant_name || restaurant?.display_name,
                    })}
              </p>
              <p className="text-xs text-gray-400 mt-6">{t("guestBookingPage.confirmationFootnote")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
              {/* Date selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {t("guestBookingPage.dateLabel")}
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {upcoming.slice(0, 14).map((d) => {
                    const has = d.slots && d.slots.length > 0;
                    const isSelected = d.date === selectedDate;
                    return (
                      <button
                        type="button"
                        key={d.date}
                        disabled={!has}
                        onClick={() => { setSelectedDate(d.date); setSelectedTime(""); }}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                          isSelected ? "bg-brand-600 text-white border-brand-600"
                          : has ? "border-gray-200 hover:border-brand-400 text-gray-700"
                          : "border-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        {fmtDate(d.date, i18n.language)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slot selector */}
              {selectedDay && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                    {t("guestBookingPage.timeLabel")}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedDay.slots.map((s) => {
                      const isSelected = s.time === selectedTime;
                      const has = s.remaining_covers >= partySize;
                      return (
                        <button
                          type="button"
                          key={s.time}
                          disabled={!has}
                          onClick={() => setSelectedTime(s.time)}
                          className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                            isSelected ? "bg-brand-600 text-white border-brand-600"
                            : has ? "border-gray-200 hover:border-brand-400 text-gray-700"
                            : "border-gray-100 text-gray-300 cursor-not-allowed"
                          }`}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Party size */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {t("guestBookingPage.partyLabel")}
                </label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))}
                    className="w-10 h-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50">−</button>
                  <span className="text-xl font-extrabold text-gray-900 min-w-[3ch] text-center">{partySize}</span>
                  <button type="button" onClick={() => setPartySize(Math.min(20, partySize + 1))}
                    className="w-10 h-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50">+</button>
                  <span className="text-xs text-gray-500 ml-1">{t("guestBookingPage.partyHint")}</span>
                </div>
              </div>

              {/* Name + phone (required), email + notes (optional) */}
              <div className="space-y-3">
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={t("guestBookingPage.namePh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("guestBookingPage.phonePh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("guestBookingPage.emailPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder={t("guestBookingPage.notesPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>

              {submitErr && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{submitErr}</p>
              )}

              <button type="submit" disabled={submitting || !selectedDate || !selectedTime}
                className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {submitting ? t("guestBookingPage.submitting") : t("guestBookingPage.submit")}
              </button>

              <p className="text-xs text-gray-400 text-center">
                {t("guestBookingPage.footnote")}
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// Render outside the usual app shell — the guest page is its own
// surface, no consumer/restaurant nav, no auth gate.
GuestBookingPage.bareLayout = true;
