import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function CRM() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", favorite_items: "", notes: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetch = () => {
    setLoading(true);
    Promise.all([api.getCustomers(search), api.getCRMSummary()])
      .then(([c, s]) => { setCustomers(c); setSummary(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [search]);

  const openNew = () => { setEditCustomer(null); setForm({ name: "", email: "", phone: "", favorite_items: "", notes: "", tags: "" }); setShowForm(true); };
  const openEdit = (c) => { setEditCustomer(c); setForm({ name: c.name, email: c.email || "", phone: c.phone || "", favorite_items: c.favorite_items || "", notes: c.notes || "", tags: c.tags || "" }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("crmPage.nameRequired")); return; }
    setSaving(true); setError(null);
    try {
      if (editCustomer) await api.updateCustomer(editCustomer.id, form);
      else await api.createCustomer(form);
      setShowForm(false);
      fetch();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      message: t("crmPage.removePrompt"),
      confirmLabel: t("crmPage.removeBtn"),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteCustomer(id);
          fetch();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const tagColor = (tag) => {
    const colors = { vip: "bg-amber-100 text-amber-700", regular: "bg-blue-100 text-blue-700", corporate: "bg-purple-100 text-purple-700", birthday: "bg-pink-100 text-pink-700", "no-show": "bg-red-100 text-red-600", foodie: "bg-green-100 text-green-700" };
    return colors[tag] || "bg-gray-100 text-gray-600";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("crmPage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("crmPage.subtitle")}</p>
        </div>
        <button onClick={openNew} className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors">{t("crmPage.addCustomer")}</button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: t("crmPage.totalCustomers"), value: summary.total_customers, icon: "👥" },
            { label: t("crmPage.vipMembers"),     value: summary.vip_count,        icon: "⭐" },
            { label: t("crmPage.avgSpend"),       value: `$${summary.avg_spend.toFixed(0)}`, icon: "💰" },
            { label: t("crmPage.totalRevenue"),   value: `$${summary.total_revenue.toLocaleString()}`, icon: "📈" },
          ].map((s) => (
            <div key={s.label} className="card">
              <div className="text-xl mb-1">{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("crmPage.searchPlaceholder")}
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{t("crmPage.colCustomer")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("crmPage.colVisits")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("crmPage.colTotalSpend")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("crmPage.colLastVisit")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("crmPage.colTags")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">{t("crmPage.loading")}</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.email || c.phone || "—"}</p>
                  {c.favorite_items && <p className="text-xs text-gray-400 truncate max-w-[180px]">❤️ {c.favorite_items}</p>}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800">{c.total_visits}</td>
                <td className="px-4 py-3 font-semibold text-brand-700">${c.total_spend.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{c.last_visit || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags || "").split(",").filter(Boolean).map((t) => (
                      <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(t.trim())}`}>{t.trim()}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(c)} className="text-xs text-brand-600 hover:underline">{t("crmPage.edit")}</button>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">{t("crmPage.delete")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-4">{editCustomer ? t("crmPage.editModalTitle") : t("crmPage.addModalTitle")}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[["name","crmPage.name"], ["email","crmPage.email"], ["phone","crmPage.phone"]].map(([key, labelKey]) => (
                  <div key={key} className={key === "name" ? "col-span-2" : ""}>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">{t(labelKey)}</label>
                    <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.favouriteItems")}</label>
                <input value={form.favorite_items} onChange={(e) => setForm((f) => ({ ...f, favorite_items: e.target.value }))} placeholder={t("crmPage.favouriteItemsPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.tagsLabel")}</label>
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder={t("crmPage.tagsPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.notes")}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60">
                  {saving ? t("crmPage.saving") : t("crmPage.save")}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">{t("crmPage.cancel")}</button>
              </div>
            </form>
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
