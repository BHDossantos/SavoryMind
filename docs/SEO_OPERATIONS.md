# SEO Operations — manual steps for Bruno

The code side (crawlable pages, sitemap.xml, robots.txt, llms.txt, structured
data) ships with the P0 deploy. These remaining steps need your Google/Bing
accounts and take ~20 minutes total.

## 1. Google Search Console (do first)

1. Go to https://search.google.com/search-console and sign in with the Google
   account that owns the savorymind.net domain.
2. Add property → **Domain** → `savorymind.net`. Google shows a TXT record —
   add it in your DNS (same place the Cloud Run domain mapping records live).
   Verification usually completes within minutes.
3. Once verified: left menu → **Sitemaps** → enter `sitemap.xml` → Submit.
4. Left menu → **URL Inspection** → paste `https://savorymind.net/` →
   **Request indexing**. Repeat for `/pricing` and `/ristoranti`.
5. Check back after 3–7 days: **Pages** report shows what's indexed;
   **Performance** shows impressions/clicks per query. The queries to watch:
   "savorymind", "spreco alimentare ristorante", "software gestione sprechi
   ristorante".

## 2. Bing Webmaster Tools

1. https://www.bing.com/webmasters → sign in → **Add site**.
2. Easiest path: choose **Import from Google Search Console** — it copies the
   verified property and sitemap in one click. Done.

## 3. Rich results check (after deploy)

1. https://search.google.com/test/rich-results → test `https://savorymind.net/`
   → should detect **FAQ** and **Organization**.
2. Test `https://savorymind.net/pricing` → should detect **SoftwareApplication**
   with the three price offers.
3. If anything fails, screenshot the error and file it — it's a code fix, not
   a console problem.

## 4. Verify crawlability yourself (30 seconds, anytime)

In any terminal:

    curl -s https://savorymind.net | grep -i "<h1"

You should see the Italian H1 («Il tuo ristorante sta perdendo…») in the raw
HTML. If you see nothing, rendering has regressed — file it as a P0 bug.

## 5. What NOT to do

- Don't pay for "SEO submission" services; the sitemap submission above is the
  whole game.
- Don't buy the savoryai/saivory domains reactively — the /confronto pages
  (P3) are the planned defense against the name-collision competitors.
