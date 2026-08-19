/**
 * /sitemap.xml — Pages Router pattern: getServerSideProps streams the XML
 * straight to the response; the page component itself never renders.
 * Lists every public marketing route with <lastmod> and hreflang
 * alternate links for the IT/EN pairs (DEVELOPER_NOTES §2.2).
 */
const BASE_URL = "https://savorymind.net";

// Fixed build-date constant — bump when marketing content meaningfully
// changes (crawlers distrust sitemaps whose lastmod updates on every
// request).
const LASTMOD = "2026-07-03";

// IT/EN pairs get xhtml:link alternates (plus x-default → IT).
const LOCALIZED_PAIRS = [
  { it: "/", en: "/en" },
  { it: "/pricing", en: "/en/pricing" },
];

// Single-locale marketing + legal/support routes.
const SINGLE_ROUTES = [
  "/ristoranti",
  "/calcolatore-spreco",
  "/come-funziona",
  "/case-studies",
  "/contatti",
  "/per-chi-ama-il-cibo",
  "/legal/privacy",
  "/legal/terms",
  "/support",
];

function alternates(pair) {
  return [
    `    <xhtml:link rel="alternate" hreflang="it-IT" href="${BASE_URL}${pair.it}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en-US" href="${BASE_URL}${pair.en}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${pair.it}"/>`,
  ].join("\n");
}

function urlEntry(loc, alternateLinks = "") {
  return [
    "  <url>",
    `    <loc>${BASE_URL}${loc}</loc>`,
    alternateLinks,
    `    <lastmod>${LASTMOD}</lastmod>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSitemap() {
  const entries = [];
  LOCALIZED_PAIRS.forEach((pair) => {
    entries.push(urlEntry(pair.it, alternates(pair)));
    entries.push(urlEntry(pair.en, alternates(pair)));
  });
  SINGLE_ROUTES.forEach((route) => entries.push(urlEntry(route)));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
  ].join("\n");
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Cache at the edge/CDN for a day; the content only changes on deploy.
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");
  res.write(buildSitemap());
  res.end();
  return { props: {} };
}

// The response is fully written by getServerSideProps — nothing to render.
export default function Sitemap() {
  return null;
}
