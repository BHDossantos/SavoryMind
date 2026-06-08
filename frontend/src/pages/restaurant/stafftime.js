import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import { fmtDateShort } from "../../utils/format";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function StaffTime() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [form, setForm] = useState({ staff_name: "", date: "", clock_in: "", clock_out: "", break_minutes: "0", notes: "" });

  const load = () => {
    setLoading(true);
    Promise.all([api.getStaffTimeLogs(), api.getStaffTimeSummary()])
      .then(([l, s]) => { setLogs(l); setSummary(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.staff_name.trim()) { setError(t("staffTimePage.errStaffRequired")); return; }
    if (!form.date.trim()) { setError(t("staffTimePage.errDateRequired")); return; }
    if (!form.clock_in.trim() || !form.clock_out.trim()) { setError(t("staffTimePage.errTimesRequired")); return; }
    if (form.clock_out <= form.clock_in) { setError(t("staffTimePage.errTimeOrder")); return; }
    const breakMins = parseInt(form.break_minutes, 10);
    if (isNaN(breakMins) || breakMins < 0) { setError(t("staffTimePage.errBreakNegative")); return; }
    setSaving(true); setError(null);
    try {
      await api.createStaffTimeLog({ ...form, break_minutes: breakMins });
      setShowForm(false);
      setForm({ staff_name: "", date: "", clock_in: "", clock_out: "", break_minutes: "0", notes: "" });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      message: t("staffTimePage.deletePrompt"),
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.deleteStaffTimeLog(id);
        load();
      },
    });
  };

  const staffCount = summary?.by_staff?.length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("staffTimePage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("staffTimePage.subtitle")}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600">{t("staffTimePage.logShift")}</button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-xl">📋</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_logs}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffTimePage.totalShifts")}</p>
          </div>
          <div className="card">
            <p className="text-xl">⏱️</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_hours_per_shift}h</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffTimePage.avgHoursShift")}</p>
          </div>
          <div className="card">
            <p className="text-xl">🔴</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.overtime_shifts}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffTimePage.overtimeShifts")}</p>
          </div>
          <div className="card">
            <p className="text-xl">🧑‍🍳</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{staffCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffTimePage.staffMembers")}</p>
          </div>
        </div>
      )}

      {/* By-staff table */}
      {summary?.by_staff?.length > 0 && (
        <div className="card overflow-hidden p-0 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{t("staffTimePage.hoursByStaff")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colStaffName")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colTotalHours")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colShifts")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colAvgHrs")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.by_staff.map((s) => (
                <tr key={s.staff_name} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{s.staff_name}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">{s.total_hours}h</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.shifts}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {s.shifts > 0 ? (s.total_hours / s.shifts).toFixed(1) : "—"}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t("staffTimePage.allShiftLogs")}</h2>
        </div>
        {loading ? <p className="p-5 text-sm text-gray-400">{t("staffTimePage.loading")}</p> : logs.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">{t("staffTimePage.noShifts")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colStaff")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colDate")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colClockIn")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colClockOut")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colBreak")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("staffTimePage.colTotalHours")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{l.staff_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDateShort(l.date, i18n.language)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{l.clock_in}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{l.clock_out}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{l.break_minutes}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">
                    {l.total_hours}h
                    {l.total_hours > 8 && <span className="ml-1 text-xs text-red-500 font-semibold">{t("staffTimePage.otBadge")}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(l.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-4">{t("staffTimePage.modalTitle")}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffTimePage.staffName")}</label>
                  <input name="staff_name" value={form.staff_name} onChange={handleChange} placeholder={t("staffTimePage.staffNamePh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffTimePage.date")}</label>
                  <input type="date" name="date" value={form.date} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffTimePage.clockIn")}</label>
                  <input type="time" name="clock_in" value={form.clock_in} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffTimePage.clockOut")}</label>
                  <input type="time" name="clock_out" value={form.clock_out} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffTimePage.breakMins")}</label>
                <input type="number" name="break_minutes" value={form.break_minutes} onChange={handleChange} min="0" step="5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffTimePage.notes")}</label>
                <input name="notes" value={form.notes} onChange={handleChange} placeholder={t("staffTimePage.notesPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60">
                  {saving ? t("staffTimePage.saving") : t("staffTimePage.save")}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">{t("staffTimePage.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
