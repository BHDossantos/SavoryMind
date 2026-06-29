import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

// Backend-stored IDs stay English; display labels via i18n.
const ROLES = ["chef", "server", "bartender", "host", "manager"];
const SHIFTS = ["morning", "afternoon", "evening", "full"];
const ROLE_ICONS = { chef: "👨‍🍳", server: "🧑‍🍽️", bartender: "🍸", host: "🤝", manager: "📋" };
const ROLE_LABEL_KEYS = {
  chef:      "staffPage.roleChef",
  server:    "staffPage.roleServer",
  bartender: "staffPage.roleBartender",
  host:      "staffPage.roleHost",
  manager:   "staffPage.roleManager",
};
const SHIFT_LABEL_KEYS = {
  morning:   "staffPage.shiftMorning",
  afternoon: "staffPage.shiftAfternoon",
  evening:   "staffPage.shiftEvening",
  full:      "staffPage.shiftFull",
};

const stars = (rating) => {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
};

export default function Staff() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ name: "", role: "server", shift: "evening", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetch = () => {
    setLoading(true);
    Promise.all([api.getStaff(), api.getStaffSummary()])
      .then(([s, sm]) => { setStaff(s); setSummary(sm); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditMember(null); setForm({ name: "", role: "server", shift: "evening", notes: "" }); setShowForm(true); };
  const openEdit = (m) => { setEditMember(m); setForm({ name: m.name, role: m.role, shift: m.shift, notes: m.notes || "" }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("staffPage.nameRequired")); return; }
    setSaving(true); setError(null);
    try {
      if (editMember) await api.updateStaff(editMember.id, form);
      else await api.createStaff(form);
      setShowForm(false); fetch();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (m) => {
    await api.updateStaff(m.id, { active: !m.active });
    fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("staffPage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("staffPage.subtitle")}</p>
        </div>
        <button onClick={openNew} className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors">{t("staffPage.addStaff")}</button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="text-xl mb-1">👥</div>
            <p className="text-2xl font-bold text-gray-900">{summary.total_staff}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffPage.activeStaff")}</p>
          </div>
          <div className="card">
            <div className="text-xl mb-1">⭐</div>
            <p className="text-2xl font-bold text-gray-900">{summary.avg_rating?.toFixed(1)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffPage.avgRating")}</p>
          </div>
          <div className="card">
            <div className="text-xl mb-1">🏆</div>
            <p className="text-lg font-bold text-gray-900 truncate">{summary.top_performer}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("staffPage.topPerformer")}</p>
          </div>
          <div className="card">
            <div className="text-xl mb-1">📊</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(summary.by_role || {}).map(([role, count]) => (
                <span key={role} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{ROLE_ICONS[role]} {count}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{t("staffPage.byRole")}</p>
          </div>
        </div>
      )}

      {/* Staff cards */}
      {loading ? <p className="text-gray-400 text-sm">{t("staffPage.loading")}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((m) => {
            const roleLabel  = ROLE_LABEL_KEYS[m.role]   ? t(ROLE_LABEL_KEYS[m.role])   : m.role;
            const shiftLabel = SHIFT_LABEL_KEYS[m.shift] ? t(SHIFT_LABEL_KEYS[m.shift]) : m.shift;
            return (
              <div key={m.id} className={`bg-white rounded-2xl p-5 shadow-sm border ${m.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-xl">
                      {ROLE_ICONS[m.role] || "👤"}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-500">{roleLabel} • {shiftLabel}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(m)} className="text-xs text-brand-600 hover:underline">{t("staffPage.edit")}</button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("staffPage.rating")}</span>
                    <span className="text-amber-500 font-medium">{stars(m.rating)} ({m.rating.toFixed(1)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("staffPage.ordersHandled")}</span>
                    <span className="font-medium text-gray-800">{m.orders_handled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("staffPage.avgOrder")}</span>
                    <span className="font-medium text-brand-700">${m.avg_order_value.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("staffPage.punctuality")}</span>
                    <span className={`font-medium ${m.punctuality_score >= 95 ? "text-green-600" : m.punctuality_score >= 85 ? "text-amber-600" : "text-red-600"}`}>
                      {m.punctuality_score}%
                    </span>
                  </div>
                </div>

                {m.notes && <p className="mt-3 text-xs text-gray-400 italic border-t border-gray-100 pt-2">{m.notes}</p>}

                <button
                  onClick={() => handleToggleActive(m)}
                  className={`mt-3 w-full text-xs py-1.5 rounded-lg transition-colors ${m.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                >
                  {m.active ? t("staffPage.markInactive") : t("staffPage.reactivate")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-4">{editMember ? t("staffPage.editTitle") : t("staffPage.addTitle")}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffPage.name")}</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffPage.role")}</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL_KEYS[r])}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffPage.shift")}</label>
                  <select value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {SHIFTS.map((s) => <option key={s} value={s}>{t(SHIFT_LABEL_KEYS[s])}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("staffPage.notes")}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60">
                  {saving ? t("staffPage.saving") : t("staffPage.save")}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">{t("staffPage.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
