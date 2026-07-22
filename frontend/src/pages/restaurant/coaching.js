import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

// Incident taxonomy — icon per type; owner picks by glance during service.
const TYPES = [
  { key: "waste", icon: "🗑️" },
  { key: "portioning", icon: "⚖️" },
  { key: "speed", icon: "⏱️" },
  { key: "punctuality", icon: "🕐" },
  { key: "quality", icon: "⭐" },
];
const CAUSE_TAGS = [
  "over_portioning", "cooking_error", "spoilage", "prep_waste",
  "slow_ticket", "late_arrival", "recipe_deviation", "plating",
];
const PRIORITY_STYLE = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

export default function CoachingPage() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState("waste");
  const [amount, setAmount] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [causes, setCauses] = useState([]);
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [flash, setFlash] = useState(false);
  const [logError, setLogError] = useState(null);

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState(null);

  useEffect(() => {
    api.getStaff().then((s) => {
      setStaff(s || []);
      if (s && s.length) setStaffId(String(s[0].id));
    }).catch(() => setStaff([]));
  }, []);

  const loadPlans = useCallback(() => {
    setLoadingPlans(true);
    api.getCoachingPlans().then((r) => setPlans(r.plans || []))
      .catch(() => setPlans([])).finally(() => setLoadingPlans(false));
  }, []);
  useEffect(() => { loadPlans(); }, [loadPlans]);

  const toggleCause = (c) =>
    setCauses((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const submit = async () => {
    if (!staffId || !amount) return;
    setLogging(true); setLogError(null);
    try {
      await api.logIncident({
        staff_id: Number(staffId), type,
        euro_impact: Number(amount),
        quantity: quantity ? Number(quantity) : undefined,
        cause_tags: causes.length ? causes : undefined,
        notes: notes || undefined,
      });
      setAmount(""); setQuantity(""); setCauses([]); setNotes("");
      setFlash(true); setTimeout(() => setFlash(false), 1500);
    } catch (e) {
      setLogError(e.message || t("coaching.logError"));
    } finally {
      setLogging(false);
    }
  };

  const generate = async () => {
    setGenerating(true); setPlanError(null);
    try { await api.generateCoachingPlans(); loadPlans(); }
    catch (e) { setPlanError(e.message || t("coaching.generateError")); }
    finally { setGenerating(false); }
  };

  const approve = async (id) => {
    try { await api.approveCoachingPlan(id); loadPlans(); }
    catch (e) { setPlanError(e.message || t("coaching.approveError")); }
  };
  const approveAll = async () => {
    try { await api.approveAllCoachingPlans(); loadPlans(); }
    catch (e) { setPlanError(e.message || t("coaching.approveError")); }
  };

  const staffName = (id) =>
    (staff.find((s) => s.id === id) || {}).name || t("coaching.unknownStaff");
  const drafts = plans.filter((p) => p.status === "draft");
  const active = plans.filter((p) => p.status === "active");

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <h1 className="text-2xl font-bold text-gray-900">{t("coaching.title")}</h1>
      <p className="text-gray-500 mt-1 mb-6">{t("coaching.subtitle")}</p>

      {/* Quick-log */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          {t("coaching.quickLogEyebrow")}
        </p>
        <h2 className="font-semibold text-gray-800 mt-1 mb-4">{t("coaching.quickLogTitle")}</h2>

        {staff.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3">{t("coaching.noStaff")}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500">{t("coaching.stepWho")}</label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">{t("coaching.stepWhat")}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TYPES.map((ty) => (
                  <button key={ty.key} onClick={() => setType(ty.key)}
                    className={`px-3 py-2 rounded-xl text-sm border transition ${
                      type === ty.key ? "bg-brand-600 text-white border-brand-600"
                                      : "bg-white text-gray-700 border-gray-200 hover:border-brand-300"}`}>
                    {ty.icon} {t(`coaching.type.${ty.key}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">{t("coaching.stepHowMuch")}</label>
                <input type="number" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <button onClick={submit} disabled={logging || !amount || !staffId}
                className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50">
                {flash ? t("coaching.logged") : t("coaching.logButton")}
              </button>
            </div>

            <button onClick={() => setShowDetails((v) => !v)}
              className="text-sm text-brand-600 font-medium">
              {showDetails ? "▲" : "▼"} {t("coaching.detailsToggle")}
            </button>
            {showDetails && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  placeholder={t("coaching.quantity")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <div>
                  <label className="text-xs font-medium text-gray-500">{t("coaching.causeTags")}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CAUSE_TAGS.map((c) => (
                      <button key={c} onClick={() => toggleCause(c)}
                        className={`px-2.5 py-1 rounded-full text-xs border ${
                          causes.includes(c) ? "bg-brand-50 text-brand-700 border-brand-300"
                                             : "bg-white text-gray-600 border-gray-200"}`}>
                        {t(`coaching.cause.${c}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder={t("coaching.notesPlaceholder")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
            )}
            {logError && <p className="text-sm text-red-600">{logError}</p>}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-800">{t("coaching.plansTitle")}</h2>
          <div className="flex gap-2">
            {drafts.length > 0 && (
              <button onClick={approveAll} className="text-sm px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 font-medium hover:bg-brand-50">
                {t("coaching.approveAll")}
              </button>
            )}
            <button onClick={generate} disabled={generating}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
              {t("coaching.generateButton")}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t("coaching.plansSub")}</p>
        {planError && <p className="text-sm text-red-600 mb-3">{planError}</p>}

        {loadingPlans ? (
          <p className="text-sm text-gray-400 animate-pulse">{t("coaching.loading")}</p>
        ) : plans.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-semibold text-gray-700">{t("coaching.plansEmptyTitle")}</p>
            <p className="text-sm text-gray-500 mt-1">{t("coaching.plansEmptyBody")}</p>
          </div>
        ) : (
          <>
            {drafts.length > 0 && (
              <p className="text-xs font-semibold uppercase text-gray-400 mb-2">{t("coaching.draftsLabel")}</p>
            )}
            {drafts.map((p) => (
              <PlanCard key={p.id} plan={p} name={staffName(p.staff_id)} t={t} onApprove={() => approve(p.id)} />
            ))}
            {active.length > 0 && (
              <p className="text-xs font-semibold uppercase text-gray-400 mt-4 mb-2">{t("coaching.activeLabel")}</p>
            )}
            {active.map((p) => (
              <PlanCard key={p.id} plan={p} name={staffName(p.staff_id)} t={t} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, name, t, onApprove }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[plan.priority] || PRIORITY_STYLE.medium}`}>
              {t(`coaching.priority.${plan.priority}`)}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {plan.generated_by_model ? t("coaching.aiBadge") : t("coaching.autoBadge")}
            </span>
          </div>
          <p className="text-sm text-gray-800 mt-1 font-medium">{plan.title}</p>
          <p className="text-sm text-gray-600 mt-0.5">{plan.summary}</p>
          {plan.euro_impact_total > 0 && (
            <p className="text-xs text-brand-700 font-semibold mt-1">€{plan.euro_impact_total.toFixed(0)}</p>
          )}
          <ul className="mt-2 space-y-1">
            {(plan.actions || []).map((a, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-brand-400">•</span>
                <span>{a.text}{a.due_hint ? <span className="text-gray-400"> — {a.due_hint}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
        {onApprove && (
          <button onClick={onApprove}
            className="flex-shrink-0 text-sm px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700">
            {t("coaching.approve")}
          </button>
        )}
      </div>
    </div>
  );
}
