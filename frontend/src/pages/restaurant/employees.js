import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function Employees() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees();
      setEmployees(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.display_name.trim()) { setFormError(t("employeesPage.errNameRequired")); return; }
    if (!form.email.includes("@")) { setFormError(t("employeesPage.errEmailValid")); return; }
    if (form.password.length < 6) { setFormError(t("employeesPage.errPwTooShort")); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createEmployee(form);
      setForm({ display_name: "", email: "", password: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (emp) => {
    setConfirmDialog({
      message: t("employeesPage.removePrompt", { name: emp.display_name }),
      confirmLabel: t("employeesPage.removeBtn"),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteEmployee(emp.id);
          load();
        } catch (e) {
          setError(e.message);
        }
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("employeesPage.title")}</h1>
          <p className="text-gray-400 mt-1 text-sm">{t("employeesPage.subtitle")}</p>
        </div>
        <button
          onClick={() => { setForm({ display_name: "", email: "", password: "" }); setFormError(null); setShowForm(true); }}
          className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors"
        >
          {t("employeesPage.addEmployee")}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex gap-3">
        <span className="text-xl mt-0.5">💡</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">{t("employeesPage.howItWorksTitle")}</p>
          <p
            className="text-sm text-blue-600 mt-0.5"
            // The body contains a <strong> tag for the savorymind.net/login link
            // emphasis. Translators preserve the HTML; render via
            // dangerouslySetInnerHTML so the tag renders rather than escaping.
            dangerouslySetInnerHTML={{ __html: t("employeesPage.howItWorksBody") }}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">{t("employeesPage.loading")}</p>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">👔</p>
          <p className="text-gray-500 font-medium">{t("employeesPage.emptyTitle")}</p>
          <p className="text-gray-400 text-sm mt-1">{t("employeesPage.emptySub")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-700">
                    {emp.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{emp.display_name}</p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(emp)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-lg"
                  title={t("employeesPage.removeBtn")}
                >
                  🗑️
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                <span className="text-xs text-gray-500">{t("employeesPage.staffBadge")}</span>
              </div>
            </div>
          ))}
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

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-1">{t("employeesPage.modalTitle")}</h2>
            <p className="text-sm text-gray-500 mb-4">{t("employeesPage.modalSub")}</p>
            {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{t("employeesPage.fullName")}</label>
                <input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder={t("employeesPage.fullNamePh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{t("employeesPage.email")}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t("employeesPage.emailPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{t("employeesPage.password")}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={t("employeesPage.passwordPh")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 disabled:opacity-60">
                  {saving ? t("employeesPage.creating") : t("employeesPage.createAccount")}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200">
                  {t("employeesPage.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
