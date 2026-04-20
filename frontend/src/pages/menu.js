import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api } from "../services/api";
import clsx from "clsx";

const CATEGORIES = ["All", "Mains", "Starters", "Desserts", "Drinks"];

function ProfitBadge({ margin }) {
  if (margin >= 60) return <span className="badge-positive">{margin.toFixed(0)}%</span>;
  if (margin >= 40) return <span className="badge-neutral">{margin.toFixed(0)}%</span>;
  return <span className="badge-negative">{margin.toFixed(0)}%</span>;
}

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("revenue_last_30_days");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Mains", price: "", cost: "", orders_last_30_days: "", rating: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchItems = () =>
    api.getMenuItems()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { fetchItems(); }, []);

  const filtered = items
    .filter((i) => category === "All" || i.category === category)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createMenuItem({
        ...form,
        price: parseFloat(form.price),
        cost: parseFloat(form.cost),
        orders_last_30_days: parseInt(form.orders_last_30_days) || 0,
        rating: parseFloat(form.rating) || 0,
      });
      setShowForm(false);
      setForm({ name: "", category: "Mains", price: "", cost: "", orders_last_30_days: "", rating: "", description: "" });
      fetchItems();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading menu..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Analysis</h1>
          <p className="text-gray-400 mt-1">Performance metrics for all menu items</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Cancel" : "+ Add Item"}
        </button>
      </div>

      {/* Add Item Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">New Menu Item</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {[
              { label: "Name", key: "name", type: "text", required: true },
              { label: "Price ($)", key: "price", type: "number", required: true },
              { label: "Cost ($)", key: "cost", type: "number", required: true },
              { label: "Orders (30 days)", key: "orders_last_30_days", type: "number" },
              { label: "Rating (0–5)", key: "rating", type: "number" },
              { label: "Description", key: "description", type: "text" },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  step="0.01"
                  required={required}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {["Mains", "Starters", "Desserts", "Drinks"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                category === c ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-500">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="revenue_last_30_days">Revenue</option>
            <option value="orders_last_30_days">Orders</option>
            <option value="profit_margin">Profit Margin</option>
            <option value="rating">Rating</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Margin</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Orders</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Rating</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} className={clsx("border-b border-gray-50 hover:bg-gray-50", i % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-right">${item.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">${item.cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <ProfitBadge margin={item.profit_margin} />
                  </td>
                  <td className="px-4 py-3 text-right">{item.orders_last_30_days}</td>
                  <td className="px-4 py-3 text-right font-medium">${item.revenue_last_30_days.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={clsx("font-medium", item.rating >= 4.5 ? "text-green-600" : item.rating < 3.5 ? "text-red-500" : "text-gray-700")}>
                      ⭐ {item.rating.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">{filtered.length} items shown</p>
    </div>
  );
}
