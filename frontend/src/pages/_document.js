import { Html, Head, Main, NextScript } from "next/document";

/**
 * Custom Document — exists for one reason: guaranteed-server-rendered
 * Open Graph tags.
 *
 * _app.js shows a loading spinner during SSR (auth hasn't hydrated yet),
 * so per-page next/head tags never reach link scrapers — WhatsApp,
 * iMessage, Instagram, Slack, Twitter all read the *initial* HTML and
 * run no JS. _document renders on the server unconditionally, before and
 * independent of that gate, so OG tags placed here always unfurl.
 *
 * These are site-wide defaults pointing at the dynamic /api/og/wedge
 * card (the North Star promise). Pages may still set richer per-page
 * title/description via next/head for browsers that run JS; the scraper
 * card is this one, which is exactly the brand moment we want on every
 * shared SavoryMind link.
 */
const OG_IMAGE = "https://savorymind.net/api/og/wedge";
const TITLE = "Tell us how you feel. We'll tell you what to eat.";
const DESC = "AI food intelligence that reads your mood, your taste, and any menu on earth — then gives you one confident answer.";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESC} />
        <meta name="twitter:image" content={OG_IMAGE} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
