import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const STEP_EMOJIS = ["🔪", "🔥", "🥣", "🫕", "⏱️", "🧂", "🍽️", "✨"];

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Two short beeps via Web Audio. The user already clicked Start, which counts
// as a gesture for the autoplay policy, so the AudioContext is allowed to
// produce sound. Silent-fails on browsers without Web Audio.
function playTimerBeep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const beep = (offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    };
    beep(0);
    beep(0.35);
  } catch {
    // best-effort
  }
}

function StepTimer() {
  const { t } = useTranslation();
  const [duration, setDuration] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef(null);

  const start = (secs) => {
    setRemaining(secs);
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
  };

  const reset = () => { stop(); setRemaining(0); setDuration(0); };

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const done = remaining === 0 && !running && duration > 0;

  useEffect(() => {
    if (done) playTimerBeep();
  }, [done]);

  return (
    <div className="bg-consumer-50 border border-consumer-200 rounded-2xl p-4 mt-4">
      <p className="text-xs font-bold text-consumer-700 mb-3">{t("guidedCookingPage.stepTimer")}</p>
      {running || done ? (
        <div className="flex items-center gap-4">
          <p className={`text-3xl font-mono font-bold ${done ? "text-green-600" : remaining <= 10 ? "text-red-500" : "text-consumer-700"}`}>
            {done ? t("guidedCookingPage.done") : formatTime(remaining)}
          </p>
          <div className="flex gap-2">
            {running && (
              <button onClick={stop}
                className="text-xs px-3 py-1.5 bg-white border border-consumer-300 text-consumer-700 rounded-lg font-semibold hover:bg-consumer-100">
                {t("guidedCookingPage.pause")}
              </button>
            )}
            {!running && remaining > 0 && (
              <button onClick={() => setRunning(true)}
                className="text-xs px-3 py-1.5 bg-consumer-600 text-white rounded-lg font-semibold hover:bg-consumer-700">
                {t("guidedCookingPage.resume")}
              </button>
            )}
            <button onClick={reset}
              className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg font-semibold hover:bg-gray-50">
              {t("guidedCookingPage.reset")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {[1, 2, 3, 5, 10, 15].map((m) => (
            <button key={m} onClick={() => { const s = m * 60; setDuration(s); start(s); }}
              className="text-xs px-3 py-1.5 bg-white border border-consumer-200 text-consumer-700 rounded-lg font-semibold hover:bg-consumer-50 hover:border-consumer-400">
              {t("guidedCookingPage.minLabel", { n: m })}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input type="number" min="1" max="120" placeholder={t("guidedCookingPage.minPh")}
              value={duration ? Math.floor(duration / 60) : ""}
              onChange={(e) => setDuration(Number(e.target.value) * 60)}
              className="w-16 text-xs border border-consumer-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-consumer-400"
            />
            <button onClick={() => duration > 0 && start(duration)}
              className="text-xs px-3 py-1.5 bg-consumer-600 text-white rounded-lg font-semibold hover:bg-consumer-700 disabled:opacity-50"
              disabled={!duration}>
              {t("guidedCookingPage.start")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryModal({ recipe, onSave, onSkip }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");
  const [change, setChange] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.createMemory({
        dish_name: recipe.title,
        emoji: recipe.image_emoji || "🍽️",
        rating,
        notes: notes || null,
        what_id_change: change || null,
        cuisine: recipe.cuisine || null,
        recipe_id: recipe.id || null,
      });
      onSave();
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <p className="text-4xl mb-2">{recipe.image_emoji || "🍽️"}</p>
          <h2 className="text-xl font-bold text-gray-900">{t("guidedCookingPage.howWasIt")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("guidedCookingPage.saveToJournal")}</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">{t("guidedCookingPage.yourRating")}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}
                  className={`text-2xl transition-transform hover:scale-110 ${s <= rating ? "opacity-100" : "opacity-30"}`}>
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {t("guidedCookingPage.howGo")} <span className="text-gray-400 font-normal">{t("guidedCookingPage.optional")}</span>
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t("guidedCookingPage.howGoPh")}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {t("guidedCookingPage.whatChange")} <span className="text-gray-400 font-normal">{t("guidedCookingPage.optional")}</span>
            </label>
            <textarea value={change} onChange={(e) => setChange(e.target.value)}
              placeholder={t("guidedCookingPage.whatChangePh")}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onSkip}
            className="flex-1 border border-gray-200 text-gray-500 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            {t("guidedCookingPage.skip")}
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-consumer-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
            {saving ? t("guidedCookingPage.saving") : t("guidedCookingPage.saveMemory")}
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineHelp() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    if (!query.trim() || asking) return;
    setAsking(true); setResult(null);
    try {
      const data = await api.askAssistant(query.trim());
      setResult(data);
    } catch { setResult({ title: t("guidedCookingPage.errorTitle"), answer: t("guidedCookingPage.askError") }); }
    finally { setAsking(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full border border-dashed border-consumer-300 text-consumer-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-consumer-50 transition-colors mt-2">
      {t("guidedCookingPage.helpPrompt")}
    </button>
  );

  return (
    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-amber-900">{t("guidedCookingPage.flavorTitle")}</p>
        <button onClick={() => { setOpen(false); setQuery(""); setResult(null); }}
          className="text-amber-500 hover:text-amber-700 text-lg">✕</button>
      </div>
      {result ? (
        <div className="mb-3">
          <p className="text-xs font-bold text-amber-800 mb-1">{result.title}</p>
          <p className="text-sm text-amber-900 leading-relaxed">{result.answer}</p>
          <button onClick={() => { setQuery(""); setResult(null); }}
            className="mt-2 text-xs text-amber-700 font-semibold hover:underline">{t("guidedCookingPage.askAnother")}</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={t("guidedCookingPage.helpPh")}
            className="flex-1 border border-amber-300 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button onClick={ask} disabled={!query.trim() || asking}
            className="bg-amber-600 text-white font-bold px-4 rounded-xl text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {asking ? t("guidedCookingPage.asking") : t("guidedCookingPage.askBtn")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function GuidedCookingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showMemory, setShowMemory] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try { setRecipe(await api.getRecipe(Number(id))); }
      catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading || !id) return <LoadingSpinner />;

  if (!recipe) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">😕</p>
      <p className="text-gray-500 mb-4">{t("guidedCookingPage.recipeNotFound")}</p>
      <Link href="/consumer/cook" className="text-consumer-600 font-semibold hover:underline">{t("guidedCookingPage.backToCook")}</Link>
    </div>
  );

  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 100;
  const isLast = currentStep === totalSteps - 1;

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("guidedCookingPage.youDidIt")}</h2>
        <p className="text-gray-500 mb-6">{t("guidedCookingPage.ready", { title: recipe.title })}</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => setShowMemory(true)}
            className="bg-consumer-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-consumer-700 transition-colors">
            {t("guidedCookingPage.saveJournalBtn")}
          </button>
          <Link href="/consumer/cook"
            className="border border-consumer-200 text-consumer-700 font-semibold px-6 py-3 rounded-xl hover:bg-consumer-50 transition-colors">
            {t("guidedCookingPage.backToCookBtn")}
          </Link>
        </div>
        {showMemory && (
          <MemoryModal
            recipe={recipe}
            onSave={() => { setShowMemory(false); router.push("/consumer/journal"); }}
            onSkip={() => { setShowMemory(false); router.push("/consumer/cook"); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/consumer/cook"
          className="text-sm text-consumer-600 font-semibold hover:text-consumer-800">
          {t("guidedCookingPage.stopCooking")}
        </Link>
        <div className="flex-1 h-2 bg-consumer-100 rounded-full overflow-hidden">
          <div className="h-full bg-consumer-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-bold text-consumer-600 flex-shrink-0">
          {currentStep + 1} / {totalSteps || 1}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">{recipe.image_emoji}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{recipe.title}</h1>
          <p className="text-xs text-gray-400">{recipe.cuisine} · {recipe.time_minutes} min · {recipe.difficulty}</p>
        </div>
      </div>

      {currentStep === 0 && ingredients.length > 0 && (
        <div className="bg-consumer-50 border border-consumer-200 rounded-2xl p-5 mb-6">
          <p className="text-sm font-bold text-gray-900 mb-3">{t("guidedCookingPage.beforeStart")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-consumer-400 flex-shrink-0" />
                {ing}
              </div>
            ))}
          </div>
        </div>
      )}

      {steps.length > 0 ? (
        <div className="bg-white rounded-3xl border border-consumer-200 shadow-sm p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-consumer-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
              {currentStep + 1}
            </div>
            <span className="text-2xl">{STEP_EMOJIS[currentStep % STEP_EMOJIS.length]}</span>
          </div>
          <p className="text-lg leading-relaxed text-gray-800 font-medium">
            {steps[currentStep]}
          </p>
          <StepTimer key={currentStep} />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-consumer-200 p-8 mb-6 text-center">
          <p className="text-gray-400">{t("guidedCookingPage.noSteps")}</p>
        </div>
      )}

      <InlineHelp key={currentStep} />

      <div className="flex gap-3 mt-4">
        <button onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="flex-1 border border-consumer-200 text-consumer-700 font-bold py-3.5 rounded-xl hover:bg-consumer-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          {t("guidedCookingPage.previous")}
        </button>
        {isLast ? (
          <button onClick={() => setDone(true)}
            className="flex-1 bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition-colors">
            {t("guidedCookingPage.imDone")}
          </button>
        ) : (
          <button onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="flex-1 bg-consumer-600 text-white font-bold py-3.5 rounded-xl hover:bg-consumer-700 transition-colors">
            {t("guidedCookingPage.nextStep")}
          </button>
        )}
      </div>
    </div>
  );
}
