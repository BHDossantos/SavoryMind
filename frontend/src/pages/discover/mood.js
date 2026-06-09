/**
 * Mood-to-Meal — the consumer wedge.
 *
 *   "Tell us how you feel. We'll tell you what to eat."
 *
 * Public page, no signup required. Four taps and one Claude call later,
 * the visitor walks away with a shareable personality card:
 *
 *   "Tonight you are: truffle pasta, Chianti, jazz at midnight."
 *
 * The whole acquisition flow rests on this being a 30-second journey
 * that ends with something worth screenshotting. Sign-up nudge happens
 * *after* the magic moment, never before.
 */
import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

const MOODS = [
  { id: "cozy",          emoji: "🕯️", labelKey: "moodPage.moodCozy" },
  { id: "adventurous",   emoji: "🌍", labelKey: "moodPage.moodAdventurous" },
  { id: "romantic",      emoji: "💞", labelKey: "moodPage.moodRomantic" },
  { id: "celebrating",   emoji: "🎉", labelKey: "moodPage.moodCelebrating" },
  { id: "stressed",      emoji: "😮‍💨", labelKey: "moodPage.moodStressed" },
  { id: "energized",     emoji: "⚡",  labelKey: "moodPage.moodEnergized" },
  { id: "curious",       emoji: "🧐", labelKey: "moodPage.moodCurious" },
  { id: "comfort",       emoji: "🫶", labelKey: "moodPage.moodComfort" },
];

const EXPERIENCES = [
  { id: "fast",      emoji: "⚡", labelKey: "moodPage.expFast" },
  { id: "healthy",   emoji: "🥗", labelKey: "moodPage.expHealthy" },
  { id: "indulgent", emoji: "🍫", labelKey: "moodPage.expIndulgent" },
  { id: "luxury",    emoji: "✨", labelKey: "moodPage.expLuxury" },
  { id: "social",    emoji: "🥂", labelKey: "moodPage.expSocial" },
  { id: "date",      emoji: "🌹", labelKey: "moodPage.expDate" },
];

const BUDGETS = [
  { id: "low",    label: "€",   subKey: "moodPage.budgetLow" },
  { id: "medium", label: "€€",  subKey: "moodPage.budgetMid" },
  { id: "high",   label: "€€€", subKey: "moodPage.budgetHigh" },
];

const POPULAR_CUISINES = ["Italian", "Japanese", "Mexican", "Indian", "French", "Mediterranean", "Thai", "American"];
const DIETARY = [
  { id: "vegetarian", labelKey: "moodPage.dietVeg" },
  { id: "vegan",      labelKey: "moodPage.dietVegan" },
  { id: "gluten_free",labelKey: "moodPage.dietGF" },
  { id: "non_alcoholic", labelKey: "moodPage.dietNoAlc" },
];

export default function MoodToMealPage() {
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState(0);
  const [mood, setMood] = useState("");
  const [exp, setExp]   = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [atHome, setAtHome] = useState(false);

  // Inline taste mini-profile for first-time visitors
  const [cuisines, setCuisines] = useState([]);
  const [dietary, setDietary]   = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);

  const toggleCuisine = (c) => setCuisines((cs) => cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]);
  const toggleDietary = (d) => setDietary((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]);

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.moodToMeal({
        mood, experience: exp, budget,
        location: location.trim() || null,
        at_home: atHome,
        language: i18n.language,
        cuisines,
        dietary,
      });
      setResult(res.recommendation);
    } catch (e) {
      setError(e.message || t("moodPage.errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    if (!result) return;
    const text = `${result.share_title}\n${result.share_subtitle}\n\n— SavoryMind`;
    const url = typeof window !== "undefined" ? `${window.location.origin}/discover/mood` : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "SavoryMind", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        // Caller surfaces a toast; for now just visual-confirm
        alert(t("moodPage.copied"));
      }
    } catch {
      // user cancelled the share sheet — no-op
    }
  };

  const reset = () => {
    setStep(0); setMood(""); setExp(""); setBudget("");
    setLocation(""); setAtHome(false); setResult(null); setError(null);
  };

  // Steps: 0 mood → 1 experience → 2 budget → 3 cuisines/dietary → 4 location → submit → result
  const canAdvance = (
    (step === 0 && mood) ||
    (step === 1 && exp) ||
    (step === 2 && budget) ||
    (step === 3) ||  // cuisines/dietary optional
    (step === 4)      // location optional
  );

  return (
    <>
      <Head>
        <title>{t("moodPage.title")} · SavoryMind</title>
        <meta name="description" content={t("moodPage.tagline")} />
        <meta property="og:title" content={t("moodPage.tagline")} />
        <meta property="og:description" content={t("moodPage.subtagline")} />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-consumer-50 via-white to-amber-50">
        <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
          {!result && (
            <>
              <div className="text-center mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-consumer-600 mb-2">SavoryMind</p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                  {t("moodPage.tagline")}
                </h1>
                <p className="text-sm text-gray-500 mt-3">{t("moodPage.subtagline")}</p>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 mb-6">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-consumer-600" : i < step ? "w-2 bg-consumer-300" : "w-2 bg-gray-200"}`} />
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                {step === 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-4">{t("moodPage.q1")}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {MOODS.map((m) => (
                        <button key={m.id} onClick={() => { setMood(m.id); setStep(1); }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${mood === m.id ? "border-consumer-500 bg-consumer-50" : "border-gray-200 hover:border-consumer-300"}`}>
                          <div className="text-2xl">{m.emoji}</div>
                          <div className="text-xs font-semibold text-gray-800 mt-1">{t(m.labelKey)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-4">{t("moodPage.q2")}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {EXPERIENCES.map((e) => (
                        <button key={e.id} onClick={() => { setExp(e.id); setStep(2); }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${exp === e.id ? "border-consumer-500 bg-consumer-50" : "border-gray-200 hover:border-consumer-300"}`}>
                          <div className="text-2xl">{e.emoji}</div>
                          <div className="text-xs font-semibold text-gray-800 mt-1">{t(e.labelKey)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-4">{t("moodPage.q3")}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {BUDGETS.map((b) => (
                        <button key={b.id} onClick={() => { setBudget(b.id); setStep(3); }}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${budget === b.id ? "border-consumer-500 bg-consumer-50" : "border-gray-200 hover:border-consumer-300"}`}>
                          <div className="text-2xl font-bold text-gray-900">{b.label}</div>
                          <div className="text-xs text-gray-500 mt-1">{t(b.subKey)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">{t("moodPage.q4a")}</p>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_CUISINES.map((c) => (
                          <button key={c} onClick={() => toggleCuisine(c)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${cuisines.includes(c) ? "bg-consumer-600 text-white border-consumer-600" : "border-gray-200 text-gray-600 hover:border-consumer-300"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">{t("moodPage.q4b")}</p>
                      <div className="flex flex-wrap gap-2">
                        {DIETARY.map((d) => (
                          <button key={d.id} onClick={() => toggleDietary(d.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${dietary.includes(d.id) ? "bg-consumer-600 text-white border-consumer-600" : "border-gray-200 text-gray-600 hover:border-consumer-300"}`}>
                            {t(d.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setStep(4)}
                      className="w-full mt-2 text-sm font-semibold text-consumer-700 hover:text-consumer-900">
                      {t("moodPage.continue")} →
                    </button>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">{t("moodPage.q5")}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setAtHome(false)}
                          className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${!atHome ? "border-consumer-500 bg-consumer-50" : "border-gray-200"}`}>
                          🍽️ <span className="ml-1 text-sm font-semibold">{t("moodPage.goingOut")}</span>
                        </button>
                        <button onClick={() => setAtHome(true)}
                          className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${atHome ? "border-consumer-500 bg-consumer-50" : "border-gray-200"}`}>
                          🏠 <span className="ml-1 text-sm font-semibold">{t("moodPage.atHome")}</span>
                        </button>
                      </div>
                    </div>
                    {!atHome && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">{t("moodPage.locationLabel")}</label>
                        <input value={location} onChange={(e) => setLocation(e.target.value)}
                          placeholder={t("moodPage.locationPh")}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />
                      </div>
                    )}
                    <button onClick={submit} disabled={loading}
                      className="w-full bg-consumer-600 text-white font-bold py-3 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors text-sm">
                      {loading ? t("moodPage.thinking") : t("moodPage.tellMe")}
                    </button>
                    {error && <p className="text-xs text-red-600 text-center">{error}</p>}
                  </div>
                )}

                {step > 0 && step < 4 && (
                  <button onClick={() => setStep(step - 1)}
                    className="mt-5 text-xs text-gray-400 hover:text-gray-600">
                    ← {t("moodPage.back")}
                  </button>
                )}
              </div>
            </>
          )}

          {result && (
            <div>
              <div className="text-center mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-consumer-600 mb-2">SavoryMind</p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                  {result.share_title}
                </h1>
                <p className="text-sm text-gray-500 mt-2">{result.share_subtitle}</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-consumer-100 overflow-hidden">
                <div className="bg-gradient-to-br from-consumer-500 to-consumer-700 text-white p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-consumer-100 mb-1">{t("moodPage.cardDish")}</p>
                  <p className="text-2xl font-extrabold">{result.dish}</p>
                  <p className="text-sm text-consumer-100 mt-1">{result.dish_desc}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">🍷 {t("moodPage.cardDrink")}</p>
                    <p className="font-bold text-gray-900">{result.drink}</p>
                    <p className="text-sm text-gray-500">{result.drink_desc}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">🎵 {t("moodPage.cardMusic")}</p>
                      <p className="text-sm text-gray-700">{result.music_vibe}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">🍰 {t("moodPage.cardDessert")}</p>
                      <p className="text-sm text-gray-700">{result.dessert}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={share}
                  className="bg-consumer-600 text-white font-bold py-3 rounded-xl hover:bg-consumer-700 transition-colors text-sm">
                  ✨ {t("moodPage.share")}
                </button>
                <button onClick={reset}
                  className="border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  🔄 {t("moodPage.again")}
                </button>
              </div>

              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm text-amber-900 font-semibold">{t("moodPage.saveTitle")}</p>
                <p className="text-xs text-amber-700 mt-1">{t("moodPage.saveSubtitle")}</p>
                <Link href="/signup"
                  className="inline-block mt-3 text-xs px-4 py-2 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700">
                  {t("moodPage.saveCta")}
                </Link>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            <Link href="/" className="hover:text-gray-700">SavoryMind</Link> · {t("moodPage.footer")}
          </p>
        </div>
      </div>
    </>
  );
}
