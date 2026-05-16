import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

// Backend stores English IDs; the dropdown shows translated labels.
const REASON_IDS = ["Over-portioned", "Cooking error", "Spoilage", "Over-ordered", "Dropped", "Expired", "Customer return", "Other"];
const REASON_LABEL_KEYS = {
  "Over-portioned":  "wastePage.reasonOver",
  "Cooking error":   "wastePage.reasonCooking",
  "Spoilage":        "wastePage.reasonSpoilage",
  "Over-ordered":    "wastePage.reasonOverordered",
  "Dropped":         "wastePage.reasonDropped",
  "Expired":         "wastePage.reasonExpired",
  "Customer return": "wastePage.reasonReturn",
  "Other":           "wastePage.reasonOther",
};

export default function FoodWaste() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [form, setForm] = useState({ item_name: "", staff_name: "", quantity_kg: "", estimated_cost: "", reason: "Over-portioned", notes: "" });

  const load = () => {
    setLoading(true);
    Promise.all([api.getWasteLogs(), api.getWasteSummary()])
      .then(([l, s]) => { setLogs(l); setSummary(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim() || !form.staff_name.trim()) { setError(t("wastePage.errItemStaff")); return; }
    if (parseFloat(form.quantity_kg) <= 0 || parseFloat(form.estimated_cost) <= 0) { setError(t("wastePage.errPositive")); return; }
    setSaving(true); setError(null);
    try {
      await api.createWasteLog({ ...form, quantity_kg: parseFloat(form.quantity_kg), estimated_cost: parseFloat(form.estimated_cost) });
      setShowForm(false);
      setForm({ item_name: "", staff_name: "", quantity_kg: "", estimated_cost: "", reason: "Over-portioned", notes: "" });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      message: t("wastePage.deletePrompt"),
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.deleteWasteLog(id);
        load();
      },
    });
  };

  const staffChartData = summary?.by_staff?.slice(0, 8).map((s) => ({ name: s.name.split(" ")[0], cost: s.total_cost })) || [];
  const itemChartData = summary?.by_item?.slice(0, 6).map((i) => ({ name: i.name.split(" ").slice(0, 2).join(" "), cost: i.total_cost })) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("wastePage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("wastePage.subtitle")}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600">{t("wastePage.logWaste")}</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-xl">💸</p>
            <p className="text-2xl font-bold text-red-600 mt-1">£{summary.total_cost.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("wastePage.totalCost")}</p>
          </div>
          <div className="card">
            <p className="text-xl">⚖️</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_kg} kg</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("wastePage.totalWeight")}</p>
          </div>
          <div className="card">
            <p className="text-xl">📝</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.entries}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("wastePage.incidents")}</p>
          </div>
          <div className="card">
            <p className="text-xl">⚠️</p>
            <p className="text-lg font-bold text-gray-900 mt-1 truncate">{summary.by_staff?.[0]?.name?.split(" ")[0] || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("wastePage.highestWaster")}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      {summary && staffChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">{t("wastePage.costByStaff")}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={staffChartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(v) => [`£${v.toFixed(2)}`, t("wastePage.costLabel")]} />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {staffChartData.map((_, i) => <Cell key={i} fill={i === 0 ? "#ef4444" : "#f97316"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">{t("wastePage.costByItem")}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={itemChartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(v) => [`£${v.toFixed(2)}`, t("wastePage.costLabel")]} />
                <Bar dataKey="cost" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t("wastePage.wasteLog", { count: logs.length })}</h2>
        </div>
        {loading ? <p className="p-5 text-sm text-gray-400">{t("wastePage.loading")}</p> : logs.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">{t("wastePage.noWaste")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{t("wastePage.colItem")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("wastePage.colStaff")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("wastePage.colQty")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("wastePage.colCost")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("wastePage.colReason")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("wastePage.colDate")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => {
                const reasonLabel = l.reason && REASON_LABEL_KEYS[l.reason] ? t(REASON_LABEL_KEYS[l.reason]) : (l.reason || "—");
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{l.item_name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.staff_name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{l.quantity_kg}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">£{l.estimated_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">{reasonLabel}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.date}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(l.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                );
              })}
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
            <h2 className="font-bold text-gray-900 text-lg mb-4">{t("wastePage.modalTitle")}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("wastePage.itemName")}</label>
                  <input name="item_name" value={form.item_name} onChange={handleChange} placeholder={t("wastePage.itemPh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("wastePage.staffName")}</label>
                  <input name="staff_name" value={form.staff_name} onChange={handleChange} placeholder={t("wastePage.staffPh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("wastePage.qtyKg")}</label>
                  <input type="number" name="quantity_kg" value={form.quantity_kg} onChange={handleChange} min="0.01" step="0.01" placeholder={t("wastePage.qtyPh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("wastePage.costField")}</label>
                  <input type="number" name="estimated_cost" value={form.estimated_cost} onChange={handleChange} min="0.01" step="0.01" placeholder={t("wastePage.costPh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("wastePage.reason")}</label>
                <select name="reason" value={form.reason} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {REASON_IDS.map((r) => <option key={r} value={r}>{t(REASON_LABEL_KEYS[r])}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("wastePage.notes")}</label>
                <input name="notes" value={form.notes} onChange={handleChange} placeholder={t("wastePage.notesPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60">
                  {saving ? t("wastePage.saving") : t("wastePage.logWasteBtn")}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">{t("wastePage.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
