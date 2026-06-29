/**
 * Per-result share permalink — /s?t=<title>
 *
 *   savorymind.net/s?t=Tonight%20you%20are%3A%20cacio%20e%20pepe
 *
 * This is the URL the wedge result pages put in the native share sheet,
 * so when someone forwards it (WhatsApp, iMessage, Slack), the recipient's
 * link unfurler renders a custom OG image carrying *their* title — the
 * actual virality payload. Without this, every shared link looked
 * identical to every other shared link.
 *
 * getServerSideProps runs on every request so the og:image url carries
 * the title before any JS hydrates. The page body itself is the "try it
 * yourself" landing — a recipient who taps through gets a clean path
 * into Mood-to-Meal.
 */
import Head from "next/head";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { track } from "../lib/analytics";

const MAX_TITLE = 140;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://savorymind.net";

export async function getServerSideProps({ query }) {
  const raw = typeof query.t === "string" ? query.t : "";
  // Clamp + collapse — we put this in an OG image and a <h1>, so a
  // multi-MB title from a crafted URL must never reach either.
  const title = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  return { props: { title } };
}

export default function ShareLandingPage({ title }) {
  const { t } = useTranslation();
  const ogImage = title
    ? `${SITE}/api/og/wedge?title=${encodeURIComponent(title)}`
    : `${SITE}/api/og/wedge`;
  const ogTitle = title || `${t("landing.northStar1")} ${t("landing.northStar2")}`;
  const ogDesc = t("landing.northStarSub");

  // Funnel measurement: someone arriving here came from a shared link.
  // The wedge page that generated the link tagged wedge_*_shared, so
  // the two events together close the viral-loop measurement
  // (share → click → completion).
  useEffect(() => {
    track("share_link_visited", { has_title: !!title });
  }, [title]);

  return (
    <>
      <Head>
        <title>{ogTitle} · SavoryMind</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-consumer-50 via-white to-amber-50">
        <div className="max-w-xl mx-auto px-4 py-12 sm:py-20 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-consumer-600 mb-2">
            SavoryMind
          </p>
          {title ? (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                {title}
              </h1>
              <p className="text-sm text-gray-500 mb-10">{t("sharePage.fromFriend")}</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                {t("landing.northStar1")} {t("landing.northStar2")}
              </h1>
              <p className="text-sm text-gray-500 mb-10">{t("landing.northStarSub")}</p>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
            <Link
              href="/discover/mood"
              onClick={() => track("share_landing_wedge_click", { target: "mood" })}
              className="bg-gradient-to-br from-consumer-600 to-consumer-800 text-white rounded-2xl p-5 text-left hover:shadow-lg transition-all"
            >
              <div className="text-3xl mb-2">🪄</div>
              <p className="font-bold text-sm">{t("landing.wedgeMoodTitle")}</p>
              <p className="text-xs text-consumer-100 mt-1">{t("landing.wedgeTryFree")} →</p>
            </Link>
            <Link
              href="/discover/menu"
              onClick={() => track("share_landing_wedge_click", { target: "menu" })}
              className="bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl p-5 text-left hover:shadow-lg transition-all"
            >
              <div className="text-3xl mb-2">📸</div>
              <p className="font-bold text-sm">{t("landing.wedgeMenuTitle")}</p>
              <p className="text-xs text-amber-100 mt-1">{t("landing.wedgeTryFree")} →</p>
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-10">
            <Link href="/" className="hover:text-gray-700">savorymind.net</Link>
          </p>
        </div>
      </div>
    </>
  );
}
