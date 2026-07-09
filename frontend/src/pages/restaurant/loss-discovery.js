import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LossReveal from "../../components/restaurant/LossReveal";

// Range selectors store the MIDPOINT of the chosen band (notes §4.1.1). Owners
// pick a bucket in one tap — no free numeric entry — and the engine gets a
// sensible number to calibrate against.
const PROFILE_FIELDS = [
  {
    field: "covers_per_day", labelKey: "profileCoversLabel", group: "covers",
    options: [{ key: "a", value: 25 }, { key: "b", value: 75 }, { key: "c", value: 150 }, { key: "d", value: 250 }],
  },
  {
    field: "avg_ticket_eur", labelKey: "profileTicketLabel", group: "ticket",
    options: [{ key: "a", value: 12 }, { key: "b", value: 22 }, { key: "c", value: 40 }, { key: "d", value: 65 }],
  },
  {
    field: "staff_count", labelKey: "profileStaffLabel", group: "staff",
    options: [{ key: "a", value: 2 }, { key: "b", value: 6 }, { key: "c", value: 12 }, { key: "d", value: 20 }],
  },
  {
    field: "monthly_food_purchases_eur", labelKey: "profilePurchasesLabel", group: "purchases",
    options: [{ key: "a", value: 2000 }, { key: "b", value: 5500 }, { key: "c", value: 14000 }, { key: "d", value: 28000 }],
  },
];

function StepProfile({ onDone }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState({}); // field -> option key
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const allChosen = PROFILE_FIELDS.every((f) => selected[f.field]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = {};
      PROFILE_FIELDS.forEach((f) => {
        const opt = f.options.find((o) => o.key === selected[f.field]);
        if (opt) payload[f.field] = opt.value;
      });
      await api.updateProfile(payload);
      onDone();
    } catch (e) {
      setError(e.message || t("lossDiscovery.errorGeneric"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{t("lossDiscovery.step1Eyebrow")}</p>
      <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{t("lossDiscovery.step1Title")}</h1>
      <p className="text-gray-500 mt-1 text-sm">{t("lossDiscovery.step1Subtitle")}</p>

      <div className="mt-6 space-y-5">
        {PROFILE_FIELDS.map((f) => (
          <div key={f.field}>
            <label className="text-sm font-semibold text-gray-800 mb-2 block">{t(`lossDiscovery.${f.labelKey}`)}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {f.options.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSelected((s) => ({ ...s, [f.field]: o.key }))}
                  className={`text-sm py-2.5 rounded-xl border font-medium transition-all ${
                    selected[f.field] === o.key
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-brand-400"
                  }`}
                >
                  {t(`lossDiscovery.ranges.${f.group}.${o.key}`)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      <button
        onClick={save}
        disabled={!allChosen || saving}
        className="mt-6 w-full bg-brand-600 text-white font-bold py-3 rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? t("lossDiscovery.saving") : t("lossDiscovery.continue")}
      </button>
    </div>
  );
}

function StepPath({ onPickA, onPickB }) {
  const { t } = useTranslation();
  const cards = [
    { key: "A", onClick: onPickA, icon: "📄", titleKey: "pathATitle", descKey: "pathADesc", badgeKey: "pathABadge", badgeCls: "bg-green-100 text-green-700" },
    { key: "B", onClick: onPickB, icon: "📝", titleKey: "pathBTitle", descKey: "pathBDesc", badgeKey: "pathBBadge", badgeCls: "bg-brand-100 text-brand-700" },
    { key: "C", onClick: null, icon: "🔌", titleKey: "pathCTitle", descKey: "pathCDesc", badgeKey: "pathCBadge", badgeCls: "bg-gray-100 text-gray-500" },
  ];
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{t("lossDiscovery.step2Eyebrow")}</p>
      <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{t("lossDiscovery.step2Title")}</h1>
      <p className="text-gray-500 mt-1 text-sm">{t("lossDiscovery.step2Subtitle")}</p>

      <div className="mt-6 space-y-3">
        {cards.map((c) => {
          const disabled = !c.onClick;
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={c.onClick || undefined}
              className={`w-full text-left flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                disabled
                  ? "border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed"
                  : "border-gray-200 bg-white hover:border-brand-400 hover:shadow-sm"
              }`}
            >
              <span className="text-3xl flex-shrink-0" aria-hidden>{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900">{t(`lossDiscovery.${c.titleKey}`)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeCls}`}>
                    {t(`lossDiscovery.${c.badgeKey}`)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{t(`lossDiscovery.${c.descKey}`)}</p>
              </div>
              {!disabled && <span className="text-brand-400 text-xl flex-shrink-0">→</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PathAUpload({ onEstimate, onSwitchToB, onBack }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null); // set when estimate came back null (unreadable)

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true); setError(null); setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.importSales(form);
      if (res.estimate) {
        onEstimate(res.estimate, res.import);
      } else {
        // Unreadable file — show the quarantine reason and offer Path B.
        setReport(res.import);
      }
    } catch (e) {
      setError(e.message || t("lossDiscovery.errorGeneric"));
    } finally {
      setAnalyzing(false);
    }
  };

  const quarantineReason = report?.quarantine?.[0]?.reason;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700 mb-3">← {t("lossDiscovery.back")}</button>
      <h1 className="text-2xl font-extrabold text-gray-900">{t("lossDiscovery.uploadTitle")}</h1>
      <p className="text-gray-500 mt-1 text-sm">{t("lossDiscovery.uploadSubtitle")}</p>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 p-8 text-center">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); setError(null); }}
        />
        <span className="text-4xl block mb-3" aria-hidden>📄</span>
        {file ? (
          <p className="text-sm font-medium text-gray-700 mb-3">{t("lossDiscovery.importFilePicked", { name: file.name })}</p>
        ) : (
          <p className="text-sm text-gray-500 mb-3">{t("lossDiscovery.uploadSubtitle")}</p>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="text-sm px-4 py-2 rounded-xl bg-white border border-brand-300 text-brand-700 font-semibold hover:bg-brand-100"
        >
          {t("lossDiscovery.uploadChoose")}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* Unreadable file — friendly failure + Path B escape hatch */}
      {report && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-900 text-sm">{t("lossDiscovery.importFailedTitle")}</p>
          {quarantineReason && (
            <p className="text-xs text-amber-700 mt-1">{t("lossDiscovery.importFailedReason", { reason: quarantineReason })}</p>
          )}
          <button
            onClick={onSwitchToB}
            className="mt-3 text-sm px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700"
          >
            {t("lossDiscovery.importTryPathB")}
          </button>
        </div>
      )}

      <button
        onClick={analyze}
        disabled={!file || analyzing}
        className="mt-6 w-full bg-brand-600 text-white font-bold py-3 rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {analyzing ? t("lossDiscovery.uploadAnalyzing") : t("lossDiscovery.uploadAnalyze")}
      </button>
    </div>
  );
}

// Shown briefly on a successful import before the reveal, surfacing the import
// report ("42 righe importate, 3 ignorate") + recognized column mapping.
function ImportReport({ report, onContinue }) {
  const { t } = useTranslation();
  const mapping = report?.column_mapping || {};
  const mappingEntries = Object.entries(mapping);
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="font-bold text-green-900">{t("lossDiscovery.importReportTitle")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-sm font-semibold px-3 py-1 rounded-full bg-white border border-green-200 text-green-800">
            ✅ {t("lossDiscovery.importRowsImported", { count: report?.rows_imported ?? 0 })}
          </span>
          {(report?.rows_quarantined ?? 0) > 0 && (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700">
              ⚠️ {t("lossDiscovery.importRowsSkipped", { count: report.rows_quarantined })}
            </span>
          )}
        </div>
        {mappingEntries.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-green-800 mb-1">{t("lossDiscovery.importMappingTitle")}</p>
            <ul className="text-xs text-green-900 space-y-0.5">
              {mappingEntries.map(([canonical, header]) => (
                <li key={canonical}>
                  <span className="font-mono bg-white border border-green-200 rounded px-1.5 py-0.5">{header}</span>
                  {" → "}
                  {t(`lossDiscovery.column.${canonical}`, { defaultValue: canonical })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button
        onClick={onContinue}
        className="mt-6 w-full bg-brand-600 text-white font-bold py-3 rounded-2xl hover:bg-brand-700 transition-colors"
      >
        {t("lossDiscovery.importSeeEstimate")}
      </button>
    </div>
  );
}

function PathBAudit({ onEstimate, onBack }) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({}); // question_id -> option_key
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    api.getLossAuditQuestions()
      .then((d) => setQuestions(d.questions || []))
      .catch((e) => setError(e.message || t("lossDiscovery.errorGeneric")))
      .finally(() => setLoading(false));
  };

  // Load the audit definition once when Path B mounts.
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answeredCount = questions ? questions.filter((q) => answers[q.id]).length : 0;
  const allAnswered = questions && answeredCount === questions.length && questions.length > 0;

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await api.runLossEstimate({ audit: answers });
      onEstimate(res);
    } catch (e) {
      setError(e.message || t("lossDiscovery.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 flex flex-col items-center text-gray-400">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
        <p className="text-sm">{t("lossDiscovery.loadingQuestions")}</p>
      </div>
    );
  }
  if (error && !questions) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">⚠️ {error}</p>
          <button onClick={load} className="mt-3 text-sm px-4 py-2 rounded-xl bg-red-600 text-white font-semibold">
            {t("lossDiscovery.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700 mb-3">← {t("lossDiscovery.back")}</button>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{t("lossDiscovery.auditEyebrow")}</p>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{t("lossDiscovery.auditTitle")}</h1>
        </div>
        <span className="text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-3 py-1 flex-shrink-0">
          {t("lossDiscovery.auditProgress", { current: answeredCount, total: questions.length })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
        />
      </div>

      <div className="mt-6 space-y-5">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="font-semibold text-gray-900 text-sm">
              <span className="text-gray-400 mr-1">{idx + 1}.</span>
              {t(`lossDiscovery.questions.${q.id}.prompt`)}
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  className={`text-sm text-left px-3 py-2.5 rounded-xl border font-medium transition-all ${
                    answers[q.id] === opt
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-brand-400"
                  }`}
                >
                  {t(`lossDiscovery.questions.${q.id}.options.${opt}`)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}
      {!allAnswered && (
        <p className="mt-4 text-center text-xs text-gray-400">{t("lossDiscovery.auditIncomplete")}</p>
      )}

      <button
        onClick={submit}
        disabled={!allAnswered || submitting}
        className="mt-4 w-full bg-brand-600 text-white font-bold py-3 rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? t("lossDiscovery.auditCalculating") : t("lossDiscovery.auditSubmit")}
      </button>
    </div>
  );
}

export default function LossDiscovery() {
  // Local state machine: profile → path → (audit | uploadA → importReport) → reveal
  const [step, setStep] = useState("profile");
  const [estimate, setEstimate] = useState(null);
  const [importReport, setImportReport] = useState(null);

  return (
    <div>
      {step === "profile" && <StepProfile onDone={() => setStep("path")} />}

      {step === "path" && (
        <StepPath onPickA={() => setStep("uploadA")} onPickB={() => setStep("auditB")} />
      )}

      {step === "uploadA" && (
        <PathAUpload
          onBack={() => setStep("path")}
          onSwitchToB={() => setStep("auditB")}
          onEstimate={(est, report) => { setEstimate(est); setImportReport(report); setStep("importReport"); }}
        />
      )}

      {step === "importReport" && (
        <ImportReport report={importReport} onContinue={() => setStep("reveal")} />
      )}

      {step === "auditB" && (
        <PathBAudit
          onBack={() => setStep("path")}
          onEstimate={(est) => { setEstimate(est); setStep("reveal"); }}
        />
      )}

      {step === "reveal" && <LossReveal estimate={estimate} />}
    </div>
  );
}
