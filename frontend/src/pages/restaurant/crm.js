import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

// AI Guest Intelligence — the differentiator panel. Surfaces lapsed-but-
// valuable guests with a return-probability estimate and a one-click
// win-back draft+send. This is the audit's "John hasn't visited in 41 days
// → 83% return → send 15% steak offer → [Send]" made real.
function GuestIntelligencePanel({ onSent }) {
  const { t } = useTranslation();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);      // customer being actioned
  const [draft, setDraft] = useState(null);        // {sms_body, return_probability, ...}
  const [offer, setOffer] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState(null);

  useEffect(() => {
    api.getAtRiskGuests()
      .then((d) => setGuests(d.guests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openDraft = async (g) => {
    setActive(g); setDraft(null); setOffer(""); setBusy(true);
    try {
      const d = await api.draftWinback(g.id, { offer: "", send: false });
      setDraft(d);
    } catch {} finally { setBusy(false); }
  };

  const regenerate = async () => {
    if (!active) return;
    setBusy(true);
    try { setDraft(await api.draftWinback(active.id, { offer, send: false })); }
    catch {} finally { setBusy(false); }
  };

  const send = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.draftWinback(active.id, { offer, send: true });
      setSentId(active.id);
      setActive(null); setDraft(null);
      onSent?.();
      setTimeout(() => setSentId(null), 4000);
    } catch {} finally { setBusy(false); }
  };

  if (loading || guests.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">{t("crmPage.giEyebrow")}</p>
          <h2 className="text-lg font-extrabold text-gray-900">{t("crmPage.giTitle")}</h2>
        </div>
        <span className="text-2xl" aria-hidden>🧠</span>
      </div>
      <div className="space-y-2">
        {guests.slice(0, 5).map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-purple-100 bg-white px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
              <p className="text-xs text-gray-500">
                {t("crmPage.giLapsed", { days: g.days_since_visit })} · {t("crmPage.giSpend", { amount: g.total_spend.toFixed(0) })}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-purple-700">{Math.round(g.return_probability * 100)}%</p>
              <p className="text-[10px] text-gray-400 uppercase">{t("crmPage.giReturn")}</p>
            </div>
            <button
              onClick={() => openDraft(g)}
              className="flex-shrink-0 text-xs font-bold bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700"
            >
              {sentId === g.id ? t("crmPage.giSent") : t("crmPage.giWinBack")}
            </button>
          </div>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{t("crmPage.giModalTitle", { name: active.name })}</h3>
                <p className="text-xs text-gray-500">
                  {t("crmPage.giLapsed", { days: active.days_since_visit })} ·
                  {" "}{Math.round((draft?.return_probability ?? active.return_probability) * 100)}% {t("crmPage.giReturn")}
                </p>
              </div>
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.giOfferLabel")}</label>
            <input
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder={t("crmPage.giOfferPh")}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 min-h-[72px]">
              {busy && !draft ? (
                <p className="text-sm text-gray-400">{t("crmPage.giDrafting")}</p>
              ) : (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{draft?.sms_body}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={send}
                disabled={busy || !active.phone || !draft?.sms_body}
                className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-50"
              >
                {busy ? t("crmPage.giSending") : t("crmPage.giSendSms")}
              </button>
              <button onClick={regenerate} disabled={busy} className="text-sm font-medium text-purple-600 px-3">
                {t("crmPage.giRegenerate")}
              </button>
            </div>
            {!active.phone && <p className="text-xs text-amber-600 mt-2">{t("crmPage.giNoPhone")}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

const LOYALTY_STYLES = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-gray-200 text-gray-700",
  gold:   "bg-yellow-100 text-yellow-800",
  vip:    "bg-purple-100 text-purple-800",
};

export default function CRM() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", favorite_items: "", notes: "", tags: "", menu_sms_opt_in: false, birthday: "", allergies: "", favorite_drinks: "", wine_pref: "", seating_pref: "" });
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

  const openNew = () => { setEditCustomer(null); setForm({ name: "", email: "", phone: "", favorite_items: "", notes: "", tags: "", menu_sms_opt_in: false, birthday: "", allergies: "", favorite_drinks: "", wine_pref: "", seating_pref: "" }); setShowForm(true); };
  const openEdit = (c) => { setEditCustomer(c); setForm({ name: c.name, email: c.email || "", phone: c.phone || "", favorite_items: c.favorite_items || "", notes: c.notes || "", tags: c.tags || "", menu_sms_opt_in: !!c.menu_sms_opt_in, birthday: c.birthday || "", allergies: c.allergies || "", favorite_drinks: c.favorite_drinks || "", wine_pref: c.wine_pref || "", seating_pref: c.seating_pref || "" }); setShowForm(true); };

  // Inline toggle from the table cell — single PATCH that flips just the
  // opt-in flag, no form roundtrip. Optimistic so the checkbox feels snappy.
  const toggleMenuSms = async (c) => {
    const next = !c.menu_sms_opt_in;
    setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, menu_sms_opt_in: next } : x));
    try {
      await api.updateCustomer(c.id, { menu_sms_opt_in: next });
    } catch (err) {
      // Roll back on failure.
      setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, menu_sms_opt_in: !next } : x));
      setError(err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("crmPage.nameRequired")); return; }
    setSaving(true); setError(null);
    // Empty date inputs come through as "" which the API rejects as an
    // invalid date — coerce blank date fields to null before sending.
    const payload = { ...form, birthday: form.birthday || null };
    try {
      if (editCustomer) await api.updateCustomer(editCustomer.id, payload);
      else await api.createCustomer(payload);
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

      {/* AI Guest Intelligence — win-back panel */}
      <GuestIntelligencePanel onSent={fetch} />

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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t("crmPage.colMenuSms")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">{t("crmPage.loading")}</td></tr>
            ) : customers.length === 0 && !search ? (
              <tr>
                <td colSpan={7} className="px-5 py-12">
                  <div className="text-center max-w-md mx-auto">
                    <div className="text-4xl mb-3">👋</div>
                    <p className="font-semibold text-gray-800 mb-1">{t("crmPage.emptyTitle")}</p>
                    <p className="text-sm text-gray-500 mb-4">{t("crmPage.emptyBody")}</p>
                    <button
                      onClick={openNew}
                      className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600"
                    >
                      {t("crmPage.addCustomer")}
                    </button>
                  </div>
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">{t("crmPage.noResults")}</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    {c.loyalty_tier && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${LOYALTY_STYLES[c.loyalty_tier] || "bg-gray-100 text-gray-600"}`}>
                        {t(`crmPage.loyalty${c.loyalty_tier.charAt(0).toUpperCase() + c.loyalty_tier.slice(1)}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{c.email || c.phone || "—"}</p>
                  {(c.favorite_dishes || c.favorite_items) && <p className="text-xs text-gray-400 truncate max-w-[180px]">❤️ {c.favorite_dishes || c.favorite_items}</p>}
                  {c.allergies && <p className="text-xs text-red-500 truncate max-w-[180px]">⚠ {c.allergies}</p>}
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
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!c.menu_sms_opt_in}
                      onChange={() => toggleMenuSms(c)}
                      disabled={!c.phone}
                      className="rounded text-brand-500 focus:ring-brand-400 disabled:opacity-50"
                      title={c.phone ? "" : t("crmPage.colMenuSms")}
                    />
                    <span className="text-xs text-gray-600">
                      {c.menu_sms_opt_in ? t("crmPage.menuSmsOn") : t("crmPage.menuSmsOff")}
                    </span>
                  </label>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.birthday")}</label>
                  <input type="date" value={form.birthday} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.winePref")}</label>
                  <input value={form.wine_pref} onChange={(e) => setForm((f) => ({ ...f, wine_pref: e.target.value }))} placeholder={t("crmPage.winePrefPh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.seatingPref")}</label>
                  <input value={form.seating_pref} onChange={(e) => setForm((f) => ({ ...f, seating_pref: e.target.value }))} placeholder={t("crmPage.seatingPrefPh")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.favouriteDrinks")}</label>
                  <input value={form.favorite_drinks} onChange={(e) => setForm((f) => ({ ...f, favorite_drinks: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t("crmPage.allergies")}</label>
                <input value={form.allergies} onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))} placeholder={t("crmPage.allergiesPh")}
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.menu_sms_opt_in}
                    onChange={(e) => setForm((f) => ({ ...f, menu_sms_opt_in: e.target.checked }))}
                    className="mt-0.5 rounded text-brand-500 focus:ring-brand-400"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-amber-900">{t("crmPage.menuSmsOptIn")}</span>
                    <span className="block text-xs text-amber-700 mt-0.5">{t("crmPage.menuSmsOptInHint")}</span>
                  </span>
                </label>
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
