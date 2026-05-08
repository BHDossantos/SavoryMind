import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

const CATEGORIES = [
  { value: "alcohol",        label: "Alcohol",        color: "bg-purple-100 text-purple-700" },
  { value: "food",           label: "Food",           color: "bg-orange-100 text-orange-700" },
  { value: "produce",        label: "Produce",        color: "bg-green-100 text-green-700" },
  { value: "dry_goods",      label: "Dry goods",      color: "bg-yellow-100 text-yellow-700" },
  { value: "kitchen_supply", label: "Kitchen supply", color: "bg-blue-100 text-blue-700" },
  { value: "cleaning",       label: "Cleaning",       color: "bg-gray-200 text-gray-700" },
];

const UNITS = ["bottles", "cases", "kg", "lbs", "each", "liters"];
const ADJUST_TYPES = [
  { value: "delivery",         label: "Delivery (received)" },
  { value: "usage",            label: "Usage (sold/used)" },
  { value: "waste",            label: "Waste (broken/spoiled)" },
  { value: "count_correction", label: "Count correction" },
];


function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value) || { label: value, color: "bg-gray-100 text-gray-700" };
}


function blank() {
  return {
    name: "",
    category: "food",
    unit: "each",
    par_level: "",
    reorder_quantity: "",
    supplier: "",
    cost_per_unit: "",
    notes: "",
  };
}


export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getInventory(filter);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.is_low !== b.is_low) return a.is_low ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const handleArchive = (item) => {
    setConfirmDialog({
      message: `Archive "${item.name}"? Past adjustments stay in the audit trail; the item just hides from the main list.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.archiveInventoryItem(item.id);
        load();
      },
    });
  };

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-gray-500">Track stock, log adjustments, get a weekly low-stock digest.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          + Add item
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === null ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >All</button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === c.value ? "bg-black text-white" : `${c.color} hover:opacity-80`}`}
          >{c.label}</button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {!loading && sortedItems.length === 0 && (
        <div className="card text-center py-12" data-testid="inventory-empty">
          <h2 className="text-lg font-semibold mb-1">No inventory items yet</h2>
          <p className="text-sm text-gray-500 mb-4">Add your first one to start tracking.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium"
          >+ Add your first item</button>
        </div>
      )}

      {sortedItems.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Current</th>
                <th className="text-right px-4 py-3">Par</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const cat = categoryLabel(item.category);
                return (
                  <tr key={item.id} className={`border-t ${item.is_low ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${cat.color}`}>{cat.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{item.current_quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono">{item.par_level}</td>
                    <td className="px-4 py-3">
                      {item.is_low ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">⚠ Low</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">✓ OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setAdjustingItem(item)}
                        className="text-xs text-blue-600 hover:underline"
                      >Adjust</button>
                      <button
                        onClick={() => handleArchive(item)}
                        className="text-xs text-gray-500 hover:text-red-600 hover:underline"
                      >Archive</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {adjustingItem && (
        <AdjustModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSaved={() => { setAdjustingItem(null); load(); }}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}


function AddItemModal({ onClose, onSaved }) {
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [categorizing, setCategorizing] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // On name blur, ask Claude for a category suggestion. Pre-fills the
  // dropdown but stays editable.
  const handleNameBlur = async () => {
    if (!form.name || form.name.trim().length < 3) return;
    setCategorizing(true);
    try {
      const res = await api.categorizeInventoryItem(form.name);
      if (res.category && res.confidence > 0) {
        setForm((f) => ({ ...f, category: res.category }));
      }
    } catch {
      // Categorize is a hint, never blocks. Silent on failure.
    } finally {
      setCategorizing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (parseFloat(form.par_level) < 0 || form.par_level === "") {
      setError("Par level must be 0 or greater.");
      return;
    }
    setSaving(true); setError(null);
    try {
      await api.createInventoryItem({
        name:             form.name.trim(),
        category:         form.category,
        unit:             form.unit,
        par_level:        parseFloat(form.par_level),
        reorder_quantity: form.reorder_quantity ? parseFloat(form.reorder_quantity) : null,
        supplier:         form.supplier || null,
        cost_per_unit:    form.cost_per_unit ? parseFloat(form.cost_per_unit) : null,
        notes:            form.notes || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 w-full max-w-md space-y-3"
      >
        <h2 className="text-lg font-semibold mb-2">Add inventory item</h2>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Name</span>
          <input
            value={form.name}
            onChange={update("name")}
            onBlur={handleNameBlur}
            placeholder="e.g. Tito's Vodka 1.75L"
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            required
          />
          {categorizing && <span className="text-xs text-gray-400">Suggesting category…</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs uppercase tracking-wide text-gray-500">Category</span>
            <select value={form.category} onChange={update("category")}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </label>
          <label>
            <span className="text-xs uppercase tracking-wide text-gray-500">Unit</span>
            <select value={form.unit} onChange={update("unit")}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs uppercase tracking-wide text-gray-500">Par level *</span>
            <input type="number" min="0" step="any" value={form.par_level}
                   onChange={update("par_level")}
                   className="w-full border rounded-lg px-3 py-2 text-sm mt-1" required />
          </label>
          <label>
            <span className="text-xs uppercase tracking-wide text-gray-500">Reorder qty</span>
            <input type="number" min="0" step="any" value={form.reorder_quantity}
                   onChange={update("reorder_quantity")}
                   className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Supplier</span>
          <input value={form.supplier} onChange={update("supplier")}
                 placeholder="e.g. Sysco"
                 className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Cost per unit</span>
          <input type="number" min="0" step="0.01" value={form.cost_per_unit}
                 onChange={update("cost_per_unit")}
                 className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button type="submit" disabled={saving}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}


function AdjustModal({ item, onClose, onSaved }) {
  const [type, setType] = useState("delivery");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const value = parseFloat(delta);
    if (!value || value === 0) { setError("Delta must be a non-zero number."); return; }
    setSaving(true); setError(null);
    try {
      await api.adjustInventoryItem(item.id, {
        adjustment_type: type,
        delta:           value,
        note:            note || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-xl p-6 w-full max-w-md space-y-3"
      >
        <h2 className="text-lg font-semibold mb-1">Adjust: {item.name}</h2>
        <p className="text-xs text-gray-500 mb-2">
          Current: <span className="font-mono">{item.current_quantity} {item.unit}</span> · Par: <span className="font-mono">{item.par_level}</span>
        </p>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
            {ADJUST_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">
            Delta (use negative for usage / waste)
          </span>
          <input type="number" step="any" value={delta}
                 onChange={(e) => setDelta(e.target.value)}
                 placeholder="e.g. 24 for delivery, -3 for usage"
                 className="w-full border rounded-lg px-3 py-2 text-sm mt-1" required />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="Optional — e.g. Sysco delivery #12345"
                 className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button type="submit" disabled={saving}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Log adjustment"}
          </button>
        </div>
      </form>
    </div>
  );
}
