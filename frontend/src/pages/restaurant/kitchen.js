import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../../services/api";

export default function KitchenTimes() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ item_name: "", staff_name: "", prep_minutes: "", cook_minutes: "", notes: "" });

  const load = () => {
    setLoading(true);
    Promise.all([api.getDishTimes(), api.getKitchenSummary()])
      .then(([l, s]) => { setLogs(l); setSummary(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim() || !form.staff_name.trim()) { setError("Item and staff name required."); return; }
    if (parseFloat(form.prep_minutes) < 0 || parseFloat(form.cook_minutes) < 0) { setError("Times cannot be negative."); return; }
    setSaving(true); setError(null);
    try {
      await api.createDishTime({ ...form, prep_minutes: parseFloat(form.prep_minutes), cook_minutes: parseFloat(form.cook_minutes) });
      setShowForm(false);
      setForm({ item_name: "", staff_name: "", prep_minutes: "", cook_minutes: "", notes: "" });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await api.deleteDishTime(id);
    load();
  };

  const staffColors = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#fff7ed"];
  const dishChartData = summary?.by_dish?.slice(0, 6).map((d) => ({ name: d.name.split(" ").slice(0, 2).join(" "), minutes: d.avg_minutes })) || [];
  const staffChartData = summary?.by_staff?.map((s) => ({ name: s.name.split(" ")[0], minutes: s.avg_minutes })) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⏱️ Kitchen Time Tracker</h1>
          <p className="text-gray-400 mt-1">Measure prep and cook times — identify where training is needed</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600">+ Log Time</button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-xl">⏱️</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_total_minutes} min</p>
            <p className="text-xs text-gray-400 mt-0.5">Team Avg Total Time</p>
          </div>
          <div className="card">
            <p className="text-xl">🐢</p>
            <p className="text-lg font-bold text-gray-900 mt-1 truncate">{summary.slowest_dish || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">Slowest Dish</p>
          </div>
          <div className="card">
            <p className="text-xl">🏃</p>
            <p className="text-lg font-bold text-gray-900 mt-1 truncate">{summary.fastest_staff || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">Fastest Chef</p>
          </div>
          <div className="card">
            <p className="text-xl">📊</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{logs.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Entries Logged</p>
          </div>
        </div>
      )}

      {/* Charts */}
      {dishChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Avg Time by Dish (minutes)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dishChartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} min`, "Avg Time"]} />
                <Bar dataKey="minutes" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Avg Time by Chef (fastest → slowest)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={staffChartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} min`, "Avg Time"]} />
                <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                  {staffChartData.map((_, i) => <Cell key={i} fill={staffColors[i] || "#fed7aa"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-staff detail */}
      {summary?.by_staff?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {summary.by_staff.map((s, i) => (
            <div key={s.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900">{s.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? "bg-green-100 text-green-700" : i === summary.by_staff.length - 1 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {i === 0 ? "Fastest" : i === summary.by_staff.length - 1 ? "Slowest" : "Mid"}
                </span>
              </div>
              <p className="text-2xl font-bold text-brand-600">{s.avg_minutes} <span className="text-sm font-normal text-gray-500">min avg</span></p>
              <p className="text-xs text-gray-400 mt-1">{s.entries} dishes logged</p>
              {i > 0 && (
                <p className="mt-2 text-xs text-orange-600">
                  +{(s.avg_minutes - summary.by_staff[0].avg_minutes).toFixed(0)} min vs fastest
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Log table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">All Entries</h2>
        </div>
        {loading ? <p className="p-5 text-sm text-gray-400">Loading...</p> : logs.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No times logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Dish</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Chef</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prep (min)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cook (min)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{l.item_name}</td>
                  <td className="px-4 py-3 text-gray-600">{l.staff_name}</td>
                  <td className="px-4 py-3 text-right">{l.prep_minutes}</td>
                  <td className="px-4 py-3 text-right">{l.cook_minutes}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">{(l.prep_minutes + l.cook_minutes).toFixed(0)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{l.date}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(l.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Log Kitchen Time</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Dish Name *</label>
                  <input name="item_name" value={form.item_name} onChange={handleChange} placeholder="Beef Tenderloin"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Chef / Staff *</label>
                  <input name="staff_name" value={form.staff_name} onChange={handleChange} placeholder="Marco Rivera"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Prep (minutes)</label>
                  <input type="number" name="prep_minutes" value={form.prep_minutes} onChange={handleChange} min="0" step="0.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Cook (minutes)</label>
                  <input type="number" name="cook_minutes" value={form.cook_minutes} onChange={handleChange} min="0" step="0.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notes</label>
                <input name="notes" value={form.notes} onChange={handleChange} placeholder="Any context..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60">
                  {saving ? "Saving..." : "Save"}
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
