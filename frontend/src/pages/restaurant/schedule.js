import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

// Monday of the week containing `d` (ISO week start).
function mondayOf(d) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // 0 = Monday
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default function Schedule() {
  const { t, i18n } = useTranslation();
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [data, setData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [onClock, setOnClock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDay, setAddDay] = useState(null);   // date being added to
  const [form, setForm] = useState({ staff_id: "", start_time: "18:00", end_time: "23:00" });
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([api.getSchedule(weekStart), api.getStaff(), api.getClockStatus()])
      .then(([sch, st, clk]) => { setData(sch); setStaff(st); setOnClock(clk.on_clock || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [weekStart]); // eslint-disable-line

  const isOnClock = (staffId) => onClock.some((o) => o.staff_id === staffId);

  const punch = async (staffId) => {
    setBusy(true);
    try {
      if (isOnClock(staffId)) await api.clockOut(staffId);
      else await api.clockIn(staffId);
      const clk = await api.getClockStatus();
      setOnClock(clk.on_clock || []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const addShift = async () => {
    if (!form.staff_id) return;
    setBusy(true);
    try {
      await api.createShift({ staff_id: Number(form.staff_id), date: addDay,
        start_time: form.start_time, end_time: form.end_time });
      setAddDay(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeShift = async (id) => {
    try { await api.deleteShift(id); load(); } catch (e) { setError(e.message); }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dow = (iso) => new Date(iso).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric" });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("schedulePage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("schedulePage.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">←</button>
          <span className="text-sm font-medium text-gray-600">{t("schedulePage.weekOf", { date: weekStart })}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">→</button>
        </div>
      </div>

      {/* Live time clock */}
      <section className="mb-6 rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5">
        <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">{t("schedulePage.clockEyebrow")}</p>
        <h2 className="text-lg font-extrabold text-gray-900 mb-3">⏱ {t("schedulePage.clockTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {staff.length === 0 && <p className="text-sm text-gray-400">{t("schedulePage.noStaff")}</p>}
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => punch(s.id)}
              disabled={busy}
              className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors disabled:opacity-60 ${
                isOnClock(s.id)
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-green-400"
              }`}
            >
              {isOnClock(s.id) ? "🟢" : "⚪"} {s.name} · {isOnClock(s.id) ? t("schedulePage.clockOut") : t("schedulePage.clockIn")}
            </button>
          ))}
        </div>
      </section>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((d) => (
          <div key={d} className="bg-white rounded-2xl border border-gray-100 p-3 min-h-[140px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700 capitalize">{dow(d)}</p>
              <button onClick={() => { setAddDay(d); setForm({ staff_id: staff[0]?.id || "", start_time: "18:00", end_time: "23:00" }); }}
                className="text-xs text-brand-600 hover:text-brand-800 font-bold">+ {t("schedulePage.add")}</button>
            </div>
            <div className="space-y-1.5">
              {(data.days[d] || []).map((sh) => (
                <div key={sh.id} className="text-xs bg-brand-50 border border-brand-100 rounded-lg px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 truncate">{sh.staff_name}</span>
                    <button onClick={() => removeShift(sh.id)} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                  </div>
                  <span className="text-gray-500">{sh.start_time}–{sh.end_time} · {sh.hours}h</span>
                </div>
              ))}
              {(data.days[d] || []).length === 0 && <p className="text-[11px] text-gray-300">—</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly hours per staff */}
      {data.staff_hours.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-700 mb-2">{t("schedulePage.weeklyHours")}</p>
          <div className="flex flex-wrap gap-2">
            {data.staff_hours.map((sh) => (
              <span key={sh.staff_id} className={`text-xs px-3 py-1.5 rounded-full font-medium ${sh.hours >= 40 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                {sh.staff_name}: {sh.hours}h
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add shift modal */}
      {addDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-4">{t("schedulePage.addShift", { date: addDay })}</h3>
            <label className="text-xs font-medium text-gray-700 mb-1 block">{t("schedulePage.staff")}</label>
            <select value={form.staff_id} onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3">
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("schedulePage.start")}</label>
                <input value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} placeholder="18:00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("schedulePage.end")}</label>
                <input value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} placeholder="23:00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={addShift} disabled={busy} className="flex-1 bg-brand-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {t("schedulePage.save")}
              </button>
              <button onClick={() => setAddDay(null)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">
                {t("schedulePage.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
