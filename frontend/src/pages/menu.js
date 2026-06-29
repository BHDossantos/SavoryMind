import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import { api } from "../services/api";
import clsx from "clsx";

// Internal category IDs stay English — they're what the backend
// stores and filter logic compares against. The display label
// per-category comes from i18n in the render path.
const CATEGORY_IDS = ["All", "Mains", "Starters", "Desserts", "Drinks"];
const CATEGORY_LABEL_KEYS = {
  All: "menuPage.catAll",
  Mains: "menuPage.catMains",
  Starters: "menuPage.catStarters",
  Desserts: "menuPage.catDesserts",
  Drinks: "menuPage.catDrinks",
};
const EMPTY_FORM = { name: "", category: "Mains", price: "", cost: "", orders_last_30_days: "", rating: "", description: "" };

function ProfitBadge({ margin }) {
  if (margin >= 60) return <span className="badge-positive">{margin.toFixed(0)}%</span>;
  if (margin >= 40) return <span className="badge-neutral">{margin.toFixed(0)}%</span>;
  return <span className="badge-negative">{margin.toFixed(0)}%</span>;
}

// Validation returns an i18n KEY rather than a translated string so
// the renderer (which has t() in scope) translates at display time,
// re-translating on language switch.
function validateForm(form) {
  const price = parseFloat(form.price);
  const cost = parseFloat(form.cost);
  const rating = form.rating !== "" ? parseFloat(form.rating) : null;
  if (!form.name.trim()) return "menuPage.errNameRequired";
  if (isNaN(price) || price <= 0) return "menuPage.errPricePositive";
  if (isNaN(cost) || cost < 0) return "menuPage.errCostNegative";
  if (cost >= price) return "menuPage.errCostBelowPrice";
  if (rating !== null && (rating < 0 || rating > 5)) return "menuPage.errRatingRange";
  return null;
}

export default function MenuPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("revenue_last_30_days");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchItems = () =>
    api.getMenuItems()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { fetchItems(); }, []);

  const filtered = items
    .filter((i) =>
      (category === "All" || i.category === category) &&
      (search === "" || i.name.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      cost: String(item.cost),
      orders_last_30_days: String(item.orders_last_30_days),
      rating: String(item.rating),
      description: item.description || "",
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError(null);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      cost: parseFloat(form.cost),
      orders_last_30_days: parseInt(form.orders_last_30_days) || 0,
      rating: form.rating !== "" ? parseFloat(form.rating) : 0,
    };
    try {
      if (editingItem) {
        await api.updateMenuItem(editingItem.id, payload);
      } else {
        await api.createMenuItem(payload);
      }
      closeForm();
      fetchItems();
    } catch (err) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      message: t("menuPage.deletePrompt", { name: item.name }),
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeletingId(item.id);
        setDeleteError(null);
        try {
          await api.deleteMenuItem(item.id);
          fetchItems();
        } catch (err) {
          setDeleteError(err.message || t("menuPage.deleteFailed"));
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleFieldChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (formError) setFormError(null);
  };

  if (loading) return <LoadingSpinner message={t("menuPage.loading")} />;
  if (error) return <ErrorMessage message={error} onRetry={fetchItems} />;

  // Translate the form-error key once at render so the rest of the JSX
  // doesn't have to special-case error display.
  const renderedFormError = formError ? t(formError) : null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("menuPage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("menuPage.subtitle")}</p>
        </div>
        <button onClick={showForm ? closeForm : openCreate} className="btn-primary">
          {showForm ? t("menuPage.cancel") : t("menuPage.addItem")}
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">{editingItem ? t("menuPage.editTitle", { name: editingItem.name }) : t("menuPage.newTitle")}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {[
              { label: t("menuPage.name"),        key: "name", type: "text", required: true },
              { label: t("menuPage.price"),       key: "price", type: "number", required: true },
              { label: t("menuPage.cost"),        key: "cost", type: "number", required: true },
              { label: t("menuPage.orders"),      key: "orders_last_30_days", type: "number" },
              { label: t("menuPage.rating"),      key: "rating", type: "number" },
              { label: t("menuPage.description"), key: "description", type: "text" },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  step="0.01"
                  required={required}
                  value={form[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("menuPage.category")}</label>
              <select
                value={form.category}
                onChange={(e) => handleFieldChange("category", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {["Mains", "Starters", "Desserts", "Drinks"].map((c) => (
                  <option key={c} value={c}>{t(CATEGORY_LABEL_KEYS[c])}</option>
                ))}
              </select>
            </div>
            {renderedFormError && (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                {renderedFormError}
              </div>
            )}
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                {t("menuPage.cancel")}
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? t("menuPage.saving") : editingItem ? t("menuPage.saveChanges") : t("menuPage.addItemBtn")}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600 flex items-center justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder={t("menuPage.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-44"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_IDS.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                category === c ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {t(CATEGORY_LABEL_KEYS[c])}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-500">{t("menuPage.sortBy")}</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="revenue_last_30_days">{t("menuPage.sortRevenue")}</option>
            <option value="orders_last_30_days">{t("menuPage.sortOrders")}</option>
            <option value="profit_margin">{t("menuPage.sortMargin")}</option>
            <option value="rating">{t("menuPage.sortRating")}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">{t("menuPage.colItem")}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">{t("menuPage.colCategory")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colPrice")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colCost")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colMargin")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colOrders")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colRevenue")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colRating")}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">{t("menuPage.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} className={clsx("border-b border-gray-50 hover:bg-gray-50", i % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 block">{item.name}</span>
                    {item.description && (
                      <span className="text-xs text-gray-400 block mt-0.5 max-w-xs truncate">{item.description}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t(CATEGORY_LABEL_KEYS[item.category] || "menuPage.catMains")}</td>
                  <td className="px-4 py-3 text-right">${item.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">${item.cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right"><ProfitBadge margin={item.profit_margin} /></td>
                  <td className="px-4 py-3 text-right">{item.orders_last_30_days}</td>
                  <td className="px-4 py-3 text-right font-medium">${item.revenue_last_30_days.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={clsx("font-medium", item.rating >= 4.5 ? "text-green-600" : item.rating < 3.5 ? "text-red-500" : "text-gray-700")}>
                      ⭐ {item.rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title={t("menuPage.edit")}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title={t("menuPage.delete")}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">{t("menuPage.noMatch")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">{t("menuPage.shownCount", { shown: filtered.length, total: items.length })}</p>

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
