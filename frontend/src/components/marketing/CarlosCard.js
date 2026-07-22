/**
 * CarlosCard — the "Carlos moment" (DEVELOPER_NOTES §3.2, section 2).
 *
 * A designed recreation of the staff-coaching screen: employee card →
 * euro impact → cause tags → generated action plan with checkboxes.
 * This is the emotional core of the marketing site.
 *
 * IMPORTANT: the component renders from real data types — it accepts a
 * `plan` prop shaped like the backend coaching-plan model, so a future
 * real (consented) case can be swapped in without touching this file:
 *
 *   {
 *     employee: { name, role },
 *     euro_impact_total: number,   // €
 *     incidents_count:   number,
 *     total_kg:          number,
 *     cause_tags:        string[],
 *     actions:           [{ text, done }],
 *   }
 *
 * `DEMO_PLAN` is a clearly-labeled illustrative fixture ("Esempio
 * dimostrativo" badge) — never presented as a real employee. No fake
 * numbers without a label: credibility is the moat (§12).
 */

const LOCALES = { it: "it-IT", en: "en-US" };

function fmtEuro(value, lang) {
  return new Intl.NumberFormat(LOCALES[lang] || LOCALES.it, {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function fmtKg(value, lang) {
  const n = new Intl.NumberFormat(LOCALES[lang] || LOCALES.it, {
    maximumFractionDigits: 1,
  }).format(value);
  return `${n} kg`;
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

const STRINGS = {
  it: {
    demoBadge: "Esempio dimostrativo",
    lost: "persi",
    episode: "episodio",
    episodes: "episodi",
    thisMonth: "Ultimi 30 giorni",
    causes: "Cause individuate",
    plan: "Piano di coaching generato",
    planNote: "Rivisto e approvato dal titolare prima dell'invio",
    done: "Fatto",
    caption: "Ogni euro perso ha un nome, una causa e un piano per non perderlo più.",
  },
  en: {
    demoBadge: "Illustrative example",
    lost: "lost",
    episode: "incident",
    episodes: "incidents",
    thisMonth: "Last 30 days",
    causes: "Causes identified",
    plan: "Generated coaching plan",
    planNote: "Reviewed and approved by the owner before delivery",
    done: "Done",
    caption: "Every lost euro has a name, a cause, and a plan to stop losing it.",
  },
};

/**
 * Illustrative fixture — matches the coaching-plan data shape 1:1.
 * Always rendered with the "Esempio dimostrativo" badge.
 */
export const DEMO_PLAN = {
  employee: { name: "Carlos Mendes", role: "Sous chef" },
  euro_impact_total: 36.9,
  incidents_count: 3,
  total_kg: 1.7,
  cause_tags: ["Porzioni eccessive", "Errore di cottura"],
  actions: [
    { text: "Usa il porzionatore da 90 g per la pasta fresca durante il servizio serale", done: true },
    { text: "Verifica la temperatura della piastra prima di ogni cottura del branzino", done: true },
    { text: "Confronta le prime 5 porzioni della serata con la scheda ricetta", done: false },
    { text: "Check di 5 minuti con lo chef a fine turno: cosa è finito nello scarto e perché", done: false },
  ],
};

export default function CarlosCard({ plan = DEMO_PLAN, lang = "it", isDemo = true, showCaption = true }) {
  const s = STRINGS[lang] || STRINGS.it;
  const employee = plan.employee || {};
  const doneCount = (plan.actions || []).filter((a) => a.done).length;

  return (
    <figure className="w-full max-w-md mx-auto">
      {/* Warm glow behind the card — makes it read as the hero object */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute -inset-4 bg-gradient-to-br from-brand-200/60 via-amber-100/50 to-transparent rounded-[2rem] blur-2xl"
        />

        <div className="relative bg-white rounded-3xl border border-stone-200 shadow-xl shadow-brand-100/60 overflow-hidden">
          {/* Header — employee identity */}
          <div className="flex items-center justify-between gap-3 px-6 pt-6">
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                aria-hidden="true"
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-base font-extrabold flex-shrink-0"
              >
                {initials(employee.name)}
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-stone-900 text-lg leading-tight truncate">{employee.name}</p>
                <p className="text-sm text-stone-500">{employee.role}</p>
              </div>
            </div>
            {isDemo && (
              <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wide bg-stone-100 text-stone-500 border border-stone-200 rounded-full px-2.5 py-1">
                {s.demoBadge}
              </span>
            )}
          </div>

          {/* Impact strip — the money number */}
          <div className="mx-6 mt-5 rounded-2xl bg-gradient-to-br from-brand-50 to-amber-50 border border-brand-100 px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-700/70 mb-1">{s.thisMonth}</p>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-3xl font-extrabold tracking-tight text-brand-700 tabular-nums">
                {fmtEuro(plan.euro_impact_total, lang)}
              </span>
              <span className="text-sm font-semibold text-stone-600">
                {s.lost} · {plan.incidents_count}{" "}
                {plan.incidents_count === 1 ? s.episode : s.episodes} · {fmtKg(plan.total_kg, lang)}
              </span>
            </p>
          </div>

          {/* Cause tags */}
          <div className="px-6 mt-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">{s.causes}</p>
            <div className="flex flex-wrap gap-2">
              {(plan.cause_tags || []).map((tag) => (
                <span
                  key={tag}
                  className="text-[13px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 rounded-full px-3 py-1"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Action plan with checkboxes */}
          <div className="px-6 mt-5 pb-6">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{s.plan}</p>
              <p className="text-[11px] font-bold text-brand-600 tabular-nums">
                {doneCount}/{(plan.actions || []).length} {s.done.toLowerCase()}
              </p>
            </div>
            <ul className="space-y-2.5">
              {(plan.actions || []).map((action) => (
                <li
                  key={action.text}
                  className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                    action.done ? "bg-stone-50 border-stone-100" : "bg-white border-stone-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-black ${
                      action.done
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "border-stone-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span
                    className={`text-[15px] leading-snug ${
                      action.done ? "text-stone-400 line-through decoration-stone-300" : "text-stone-800 font-medium"
                    }`}
                  >
                    {action.text}
                    <span className="sr-only">{action.done ? ` — ${s.done}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-400 mt-4 flex items-center gap-1.5">
              <span aria-hidden="true">🧠</span> {s.planNote}
            </p>
          </div>
        </div>
      </div>

      {showCaption && (
        <figcaption className="text-center text-base md:text-lg font-serif italic text-stone-600 mt-6 px-4">
          &ldquo;{s.caption}&rdquo;
        </figcaption>
      )}
    </figure>
  );
}
