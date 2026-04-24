import { useState, useEffect } from "react";
import { api } from "../../services/api";
import SkeletonLoader from "../../components/SkeletonLoader";
import ConfirmDialog from "../../components/ConfirmDialog";

const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

export default function DinerHistory() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [form, setForm] = useState({
    restaurant_name: "", visit_date: new Date().toISOString().split("T")[0],
    items_ordered: "", overall_rating: 5, food_rating: 5, staff_rating: 5,
    would_return: true, highlights: "", lowlights: "", notes: "",
  });

  const load = () => {
    setLoading(true);
    api.getDinerVisits().then(setVisits).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked
      : e.target.type === "number" ? Number(e.target.value)
      : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.restaurant_name.trim()) { setError("Restaurant name required."); return; }
    setSaving(true); setError(null);
    try {
      await api.createDinerVisit(form);
      setShowForm(false);
      setForm({ restaurant_name: "", visit_date: new Date().toISOString().split("T")[0], items_ordered: "", overall_rating: 5, food_rating: 5, staff_rating: 5, would_return: true, highlights: "", lowlights: "", notes: "" });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      message: "Delete this visit log? This cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.deleteDinerVisit(id);
        load();
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📖 My Visit History</h1>
          <p className="text-gray-400 mt-1">Your personal dining record</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-diner-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-diner-700">+ Log Visit</button>
      </div>

      {loading ? (
        <SkeletonLoader type="cards" count={3} />
      ) : visits.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🍽️</p>
          <p className="text-gray-500 mb-4">No visits logged yet. Start building your dining history!</p>
          <button onClick={() => setShowForm(true)} className="bg-diner-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-diner-700">Log your first visit</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-diner-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{v.restaurant_name}</p>
                  <p className="text-xs text-gray-400">{v.visit_date}</p>
                </div>
                <button onClick={() => handleDelete(v.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Overall</span>
                  <span className="text-amber-500">{stars(v.overall_rating)} ({v.overall_rating})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Food</span>
                  <span className="text-amber-400">{stars(v.food_rating)} ({v.food_rating})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Staff</span>
                  <span className="text-amber-400">{stars(v.staff_rating)} ({v.staff_rating})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Would return?</span>
                  <span className={v.would_return ? "text-diner-600 font-medium" : "text-red-500 font-medium"}>
                    {v.would_return ? "Yes ✓" : "No ✗"}
                  </span>
                </div>
              </div>

              {v.items_ordered && (
                <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2">🍴 {v.items_ordered}</p>
              )}
              {v.highlights && (
                <p className="mt-1 text-xs text-diner-600 italic">❤️ {v.highlights}</p>
              )}
              {v.lowlights && (
                <p className="mt-1 text-xs text-red-400 italic">⚠️ {v.lowlights}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Log visit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Log a Visit</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Restaurant *</label>
                  <input name="restaurant_name" value={form.restaurant_name} onChange={handleChange} required
                    placeholder="The Blue Plate"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Date</label>
                  <input type="date" name="visit_date" value={form.visit_date} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">What did you order?</label>
                <input name="items_ordered" value={form.items_ordered} onChange={handleChange}
                  placeholder="Beef Tenderloin, Truffle Risotto, Crème Brûlée"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
              </div>

              {/* Ratings */}
              <div className="grid grid-cols-3 gap-3">
                {[["overall_rating","Overall"],["food_rating","Food"],["staff_rating","Staff"]].map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">{label} (1–5)</label>
                    <input type="number" name={field} value={form[field]} onChange={handleChange} min={1} max={5} step={0.5}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">What you loved</label>
                <input name="highlights" value={form.highlights} onChange={handleChange} placeholder="The truffle risotto was incredible..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">What could be better</label>
                <input name="lowlights" value={form.lowlights} onChange={handleChange} placeholder="Long wait for dessert..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-diner-400 resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="would_return" checked={form.would_return} onChange={handleChange} className="accent-diner-500" />
                <span className="text-sm text-gray-700">I would return to this restaurant</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-diner-600 text-white font-semibold py-2.5 rounded-xl hover:bg-diner-700 disabled:opacity-60">
                  {saving ? "Saving..." : "Save Visit"}
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
