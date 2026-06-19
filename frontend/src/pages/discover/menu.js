/**
 * Snap-a-Menu — "Order like a local, anywhere."
 *
 * Tourist sits at an unfamiliar restaurant, opens the camera, snaps the
 * menu. Five seconds later: "Get the Tagliata di manzo. The menu's
 * best value."
 *
 * Same wedge as /discover/mood, different input modality. Public,
 * no-signup, mobile-first.
 */
import { useState, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import { downscaleImage } from "../../utils/image";
import { stashWedgeTaste } from "../../utils/wedgeTaste";
import { track } from "../../lib/analytics";

const POPULAR_CUISINES = ["Italian", "Japanese", "Mexican", "Indian", "French", "Mediterranean", "Thai"];
const DIETARY = [
  { id: "vegetarian", labelKey: "menuSnapPage.dietVeg" },
  { id: "vegan",      labelKey: "menuSnapPage.dietVegan" },
  { id: "gluten_free",labelKey: "menuSnapPage.dietGF" },
  { id: "non_alcoholic", labelKey: "menuSnapPage.dietNoAlc" },
];

export default function MenuSnapPage() {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef(null);

  const [preview, setPreview]   = useState(null);  // dataURL for the <img>
  const [blob, setBlob]         = useState(null);  // downscaled JPEG ready to upload
  const [cuisines, setCuisines] = useState([]);
  const [dietary, setDietary]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      const downscaled = await downscaleImage(f);
      setBlob(downscaled);
      setPreview(URL.createObjectURL(downscaled));
      setResult(null);
      track("wedge_menu_photo_picked", { size_kb: Math.round(downscaled.size / 1024) });
    } catch (err) {
      setError(t("menuSnapPage.errCompress"));
      track("wedge_menu_photo_failed");
    }
  };

  const submit = async () => {
    if (!blob) return;
    setLoading(true); setError(null);
    try {
      const res = await api.snapMenu(blob, {
        language: i18n.language,
        cuisines,
        dietary,
      });
      setResult(res.recommendation);
      track("wedge_menu_completed", { source: res.source, language: i18n.language });
    } catch (e) {
      setError(e.message || t("menuSnapPage.errGeneric"));
      track("wedge_menu_failed");
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    if (!result) return;
    const text = `${result.share_title}\n\n— SavoryMind`;
    const url = typeof window !== "undefined" ? `${window.location.origin}/discover/menu` : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "SavoryMind", text, url });
        track("wedge_menu_shared", { method: "native" });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        track("wedge_menu_shared", { method: "clipboard" });
        alert(t("menuSnapPage.copied"));
      }
    } catch {}
  };

  const reset = () => {
    setPreview(null); setBlob(null); setResult(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleCuisine = (c) => setCuisines((cs) => cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]);
  const toggleDietary = (d) => setDietary((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]);

  return (
    <>
      <Head>
        <title>{t("menuSnapPage.title")} · SavoryMind</title>
        <meta name="description" content={t("menuSnapPage.tagline")} />
        <meta property="og:title" content={t("menuSnapPage.tagline")} />
        <meta property="og:image" content="https://savorymind.net/api/og/wedge" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://savorymind.net/api/og/wedge" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-consumer-50">
        <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
          {!result && (
            <>
              <div className="text-center mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">SavoryMind</p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                  {t("menuSnapPage.tagline")}
                </h1>
                <p className="text-sm text-gray-500 mt-3">{t("menuSnapPage.subtagline")}</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                {/* Image picker / preview */}
                {!preview ? (
                  <label className="block">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={onPick}
                      className="sr-only"
                    />
                    <div className="border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-2xl p-10 text-center cursor-pointer hover:bg-amber-50 transition-colors">
                      <p className="text-5xl mb-3">📸</p>
                      <p className="text-sm font-semibold text-amber-900">{t("menuSnapPage.tap")}</p>
                      <p className="text-xs text-amber-700 mt-1">{t("menuSnapPage.tapSub")}</p>
                    </div>
                  </label>
                ) : (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Menu" className="w-full max-h-96 rounded-xl border border-gray-200 object-contain bg-gray-50" />
                    <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700">
                      ← {t("menuSnapPage.retake")}
                    </button>
                  </div>
                )}

                {/* Inline taste mini-profile — same shape as mood page */}
                {preview && (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">{t("menuSnapPage.q4a")}</p>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_CUISINES.map((c) => (
                          <button key={c} onClick={() => toggleCuisine(c)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${cuisines.includes(c) ? "bg-amber-600 text-white border-amber-600" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">{t("menuSnapPage.q4b")}</p>
                      <div className="flex flex-wrap gap-2">
                        {DIETARY.map((d) => (
                          <button key={d.id} onClick={() => toggleDietary(d.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${dietary.includes(d.id) ? "bg-amber-600 text-white border-amber-600" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}>
                            {t(d.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={submit} disabled={loading}
                      className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 disabled:opacity-60 transition-colors text-sm">
                      {loading ? t("menuSnapPage.thinking") : t("menuSnapPage.tellMe")}
                    </button>
                    {error && <p className="text-xs text-red-600 text-center">{error}</p>}
                  </>
                )}
              </div>
            </>
          )}

          {result && (
            <div>
              <div className="text-center mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">SavoryMind</p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                  {result.dish}
                </h1>
                <p className="text-sm text-gray-500 mt-2">{result.share_title}</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
                <div className="bg-gradient-to-br from-amber-500 to-amber-700 text-white p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-100 mb-1">{t("menuSnapPage.whyHeader")}</p>
                  <p className="text-base leading-relaxed">{result.why}</p>
                </div>
                {(result.alternatives && result.alternatives.length > 0) && (
                  <div className="p-6 border-b border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t("menuSnapPage.alsoConsider")}</p>
                    <ul className="space-y-1">
                      {result.alternatives.map((a) => (
                        <li key={a} className="text-sm text-gray-800">• {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.warnings && result.warnings.length > 0) && (
                  <div className="p-6 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-800 mb-2">⚠ {t("menuSnapPage.heads")}</p>
                    <ul className="space-y-1">
                      {result.warnings.map((w) => (
                        <li key={w} className="text-sm text-amber-900">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={share}
                  className="bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-colors text-sm">
                  ✨ {t("menuSnapPage.share")}
                </button>
                <button onClick={reset}
                  className="border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  📸 {t("menuSnapPage.another")}
                </button>
              </div>

              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm text-amber-900 font-semibold">{t("menuSnapPage.saveTitle")}</p>
                <p className="text-xs text-amber-700 mt-1">{t("menuSnapPage.saveSubtitle")}</p>
                <Link href="/signup"
                  onClick={() => { stashWedgeTaste({ cuisines, dietary }); track("wedge_signup_clicked", { surface: "menu" }); }}
                  className="inline-block mt-3 text-xs px-4 py-2 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700">
                  {t("menuSnapPage.saveCta")}
                </Link>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            <Link href="/" className="hover:text-gray-700">SavoryMind</Link> · {t("menuSnapPage.footer")}
          </p>
        </div>
      </div>
    </>
  );
}
