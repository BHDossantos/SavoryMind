import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

// Locale-aware currency formatting. Italian owners must see €1.234,56, not
// $1,234.56 — this is the single source of truth for money on the reveal
// screen AND the dashboard hero card (both import fmtEur from here).
const LOCALES = { it: "it-IT", en: "en-IE", es: "es-ES", pt: "pt-PT", fr: "fr-FR" };

export function localeFor(lang) {
  return LOCALES[lang] || "en-IE";
}

export function fmtEur(amount, lang, { decimals = 0 } = {}) {
  const n = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `€${n.toFixed(decimals)}`;
  }
}

function fmtPct(fraction, lang) {
  const v = Number.isFinite(fraction) ? fraction : 0;
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(v);
  } catch {
    return `${(v * 100).toFixed(1)}%`;
  }
}

// Warm palette per category — consistent with the brand (orange) surface.
const CATEGORY_META = {
  food_waste:      { color: "bg-brand-500",   soft: "bg-brand-50 border-brand-200",   icon: "🗑️" },
  over_portioning: { color: "bg-amber-500",   soft: "bg-amber-50 border-amber-200",   icon: "🍝" },
  staff_time:      { color: "bg-orange-400",  soft: "bg-orange-50 border-orange-200",  icon: "⏱️" },
};

// Turn an evidence code + its params into a plain-language line. Every euro on
// screen traces back to one of these (notes §4.1 / §4.2).
function EvidenceLine({ item, lang, t }) {
  if (item.code === "food_waste_pct") {
    return (
      <li>
        {t("lossDiscovery.evidenceFoodWaste", {
          low: fmtPct(item.pct_low, lang),
          high: fmtPct(item.pct_high, lang),
          purchases: fmtEur(item.monthly_food_purchases, lang),
        })}
        {item.purchases_estimated && (
          <span className="text-gray-400"> {t("lossDiscovery.evidenceFoodWasteEstimated")}</span>
        )}
      </li>
    );
  }
  if (item.code === "over_portion_pct") {
    return (
      <li>
        {t("lossDiscovery.evidenceOverPortion", { pct: fmtPct(item.over_pct, lang) })}
        {item.base_estimated && (
          <span className="text-gray-400"> {t("lossDiscovery.evidenceFoodWasteEstimated")}</span>
        )}
      </li>
    );
  }
  if (item.code === "staff_hours_wasted") {
    return (
      <li>
        {t("lossDiscovery.evidenceStaff", {
          hours: (item.hours_per_week_per_staff ?? 0).toLocaleString(localeFor(lang), { maximumFractionDigits: 1 }),
          staff: item.staff_count,
          wage: fmtEur(item.hourly_wage, lang),
        })}
      </li>
    );
  }
  return null;
}

function CategoryRow({ cat, maxHigh, lang, t }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[cat.category] || CATEGORY_META.food_waste;
  const pctWidth = maxHigh > 0 ? Math.max(4, Math.round((cat.amount_high / maxHigh) * 100)) : 0;

  return (
    <div className={`rounded-2xl border ${meta.soft} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0" aria-hidden>{meta.icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">
              {t(`lossDiscovery.categories.${cat.category}`)}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                {t(`lossDiscovery.confidence.${cat.confidence}`)}
              </span>
              {cat.category === "food_waste" && (
                <span className="text-[11px] text-gray-500 italic">{t("lossDiscovery.industryBand")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-extrabold text-gray-900 text-sm whitespace-nowrap">
            {fmtEur(cat.amount_low, lang)} – {fmtEur(cat.amount_high, lang)}
          </p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("lossDiscovery.perMonth")}</p>
        </div>
      </div>

      {/* Proportional band bar */}
      <div className="mt-3 h-2.5 w-full rounded-full bg-white/70 overflow-hidden">
        <div className={`h-full rounded-full ${meta.color}`} style={{ width: `${pctWidth}%` }} />
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
      >
        {open ? t("lossDiscovery.hideEvidence") : t("lossDiscovery.showEvidence")}
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-xs text-gray-700 list-disc list-inside">
          {(cat.evidence || []).map((item, i) => (
            <EvidenceLine key={`${item.code}-${i}`} item={item} lang={lang} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

// Full-width reveal. `estimate` is the backend estimate object. Renders the
// honest guarantee path when guarantee_triggered — no scary number, no
// recovery-plan hard-sell (notes §4.1.5).
export default function LossReveal({ estimate }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language;

  if (!estimate) return null;

  const breakdown = estimate.breakdown || [];
  const maxHigh = breakdown.reduce((m, c) => Math.max(m, c.amount_high || 0), 0);
  const low = fmtEur(estimate.total_monthly_loss_low, lang);
  const high = fmtEur(estimate.total_monthly_loss_high, lang);
  const pathLabel = t(`lossDiscovery.path${estimate.data_path === "import" ? "Import" : estimate.data_path === "audit" ? "Audit" : "Profile"}`);
  const guarantee = estimate.guarantee_triggered;

  const activate = () => {
    // TODO P2: create the first coaching plans + schedule the WhatsApp digest.
    // For now the recovery plan simply lands the owner back on the dashboard.
    router.push("/dashboard");
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Headline */}
      <div
        className={`rounded-3xl border p-6 md:p-8 text-center ${
          guarantee
            ? "border-green-200 bg-gradient-to-br from-green-50 to-white"
            : "border-brand-200 bg-gradient-to-br from-brand-50 to-white"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-2">
          {guarantee ? t("lossDiscovery.revealGuaranteeEyebrow") : t("lossDiscovery.revealEyebrow")}
        </p>
        {guarantee ? (
          <>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              {t("lossDiscovery.guaranteeHeadline")}
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">{t("lossDiscovery.guaranteeSub")}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 leading-tight">
              {t("lossDiscovery.headline", { low, high })}
            </h1>
            <p className="text-gray-500 mt-3 text-sm md:text-base">
              {t("lossDiscovery.headlineSub", { path: pathLabel })}
            </p>
          </>
        )}
      </div>

      {/* Breakdown */}
      <div className="mt-6 space-y-3">
        {breakdown.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            {t("lossDiscovery.emptyBreakdown")}
          </div>
        ) : (
          breakdown.map((cat) => (
            <CategoryRow key={cat.category} cat={cat} maxHigh={maxHigh} lang={lang} t={t} />
          ))
        )}
      </div>

      {/* CTA */}
      <div className="mt-8">
        {guarantee ? (
          <button
            onClick={activate}
            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl hover:bg-green-700 transition-colors"
          >
            {t("lossDiscovery.ctaMonitorFree")}
          </button>
        ) : (
          <button
            onClick={activate}
            className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-2xl hover:bg-brand-700 transition-colors shadow-sm"
          >
            {t("lossDiscovery.ctaActivate")}
          </button>
        )}
        <p className="text-center text-[11px] text-gray-400 mt-3">{t("lossDiscovery.honestNote")}</p>
      </div>
    </div>
  );
}
