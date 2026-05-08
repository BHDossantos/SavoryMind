# SavoryMind — App Store & Play Store Submission Metadata

> All copy you'll paste into App Store Connect and Google Play Console during submission.
> Edit in place to match your brand voice — I drafted these neutrally.
> Cross-referenced against `frontend/src/pages/legal/privacy.js` so the data disclosures stay
> truthful when you fill in privacy nutrition labels / data safety forms.

---

## 1. Common metadata (paste into both stores)

### App name (max 30 chars, both stores)

```
SavoryMind
```

### Subtitle / Short description (iOS 30 chars, Android 80 chars)

**iOS subtitle (30 chars):**
```
AI for restaurants & cooks
```

**Android short description (80 chars):**
```
AI insights for restaurants, smart pantry & wine pairings for home cooks.
```

### Primary category

| Store | Category | Subcategory / Tag |
|---|---|---|
| iOS App Store | Food & Drink | (no secondary; could use Lifestyle) |
| Google Play | Food & Drink | — |

### Content rating

- **iOS age rating:** 4+ (no objectionable content; AI features write about food only)
- **Google Play content rating:** Everyone (Google's IARC questionnaire — answer "no" to every violence/sex/drugs question; "yes" only to "user-generated content visible to others" because of reviews)

### Copyright string (App Store, single field)

```
© 2026 BH Dos Santos. All rights reserved.
```

### Pricing & availability

- **Price:** Free
- **Availability:** All territories (default)
- **In-app purchases:** None (none implemented yet)

### Support URL (required by both)

```
https://savorymind.net/support
```

> ⚠ **Action needed:** create a `/support` page on the web app, or use a `mailto:` URL like `mailto:hello@savorymind.net?subject=Support`. Apple requires a real working URL — `mailto:` is allowed but a web page looks more legitimate.

### Marketing URL (optional, App Store only)

```
https://savorymind.net
```

### Privacy policy URL (mandatory, both stores)

```
https://savorymind.net/legal/privacy
```

(Page exists in `frontend/src/pages/legal/privacy.js`, ships when `feat/app-store-readiness` merges and the frontend deploys.)

### Terms of Service URL (Google Play only — optional but recommended)

```
https://savorymind.net/legal/terms
```

---

## 2. App Store Connect metadata

### Promotional text (170 chars, can be updated without app review)

```
Now with Sign in with Apple and a weekly inventory digest for restaurants. Wine pairings that actually listen — your Spotify rotation shapes the recommendations.
```

### Description (4000 chars max)

```
Hey 👋 — SavoryMind is the food intelligence platform that works for both sides of the table. The home cook trying to figure out what's for dinner. The restaurant operator trying to figure out what's actually working. Same app, different superpowers.

IF YOU'RE COOKING TONIGHT
• Wine, beer, and spirits pairings matched to whatever you're eating — with confidence scores so you know how strong the pick is.
• Music Mood — connect Spotify and we use what you're already listening to as a signal for what you might want to eat. The Bad Bunny rotation pairs well with Spanish reds. Promise.
• Pantry tracking — log what you have, find recipes that actually use it, stop the "oh I forgot we had that" cycle.
• Guided cooking — step-by-step recipe walkthroughs with built-in timers. Sauce starts breaking? Tap the help button mid-cook and the AI assistant tells you what to do, in real time.
• Food journal — save the dishes worth remembering. Rate them. Note what you'd change. Build your own personal cookbook.
• Order shortcut — pick a craving, get matched to dishes, see who delivers them best near you.

IF YOU RUN A RESTAURANT
• Sentiment analysis on every review with AI-extracted themes. See what guests actually complain about and what they actually praise — not just an average rating that hides everything important.
• Inventory tracking with a weekly low-stock email digest, fired Monday 8am restaurant-local. Counting-optimized UI for the walk-in (because no one wants to type quantities with cold fingers). Append-only audit trail that survives staff turnover.
• Sales predictions, marketing insights, training plans, menu trend analysis — all powered by Claude AI, all with sane fallbacks when AI isn't reachable.
• Bookings, CRM, staff management, food waste tracking, kitchen and staff time logging.
• Reports + CSV export for everything that matters.

IF YOU'RE A DINER
• Discover restaurants that match what you're actually craving, not what's promoted.
• Book directly through the app, track your visit history, leave reviews that the restaurant and other diners both see.

PRIVACY THAT'S ACTUALLY PRIVATE
• Sign in with Apple, Google, or email — pick whatever's least friction.
• OAuth tokens are encrypted at rest with industry-standard cryptography. Database compromise doesn't yield plaintext tokens.
• AI processing happens through Anthropic's API; your data is never used to train AI models. We have it in writing.
• Full data export and deletion on request, no questions asked.

Read the full privacy policy at savorymind.net/legal/privacy.

Got feedback or hit a bug? Email hello@savorymind.net — real humans behind every reply.
```

(~2500 chars — leaves room to add more if needed.)

### Keywords (100 chars total, comma-separated, no spaces after commas)

```
restaurant,inventory,wine,pairing,recipes,cooking,AI,sentiment,reviews,menu,bookings,delivery,pantry
```

(95 chars — leaves 5 chars for one more keyword if desired.)

### What's New in This Version (4000 chars)

```
First time on the App Store 🍝

SavoryMind has been live on the web for a while; we're bringing the full mobile experience to your phone:

• Sign in with Apple, Google, or email — pick whatever's least friction.
• Restaurant inventory tracking with a weekly low-stock email digest, counting-optimized for the walk-in.
• Spotify integration that actually uses your listening signal for wine + dish recommendations.
• Claude-powered sentiment themes, recipe suggestions, marketing insights, training plans, and a culinary assistant for when something goes wrong mid-cook.
• Three-role experience — consumer, restaurant operator, and diner all from one app.

We're shipping fast. Tell us what's missing at hello@savorymind.net — real humans, real replies.
```

### Privacy nutrition labels (App Store Connect — Privacy section)

Apple's exact taxonomy. Mapped from the actual data flow in `backend/app/services/` + the privacy policy.

**Data Used to Track You:** None
**Data Linked to You:**
- Contact Info → Email Address ← (account creation)
- Contact Info → Name ← (display_name)
- User Content → Other User Content ← (reviews, menu items, inventory adjustments, food journal)
- Identifiers → User ID ← (internal user_id)
- Diagnostics → Crash Data ← (Sentry)
- Diagnostics → Other Diagnostic Data ← (Sentry contextual data: user_id, JTI on auth flows)
- Usage Data → Product Interaction ← (recommendation engine reads stated preferences + Spotify listening history)

**Data Not Linked to You:** None (everything we collect is associated with the user account; we don't pretend otherwise).

For each category Apple asks "purpose":
- **App Functionality** ← all of the above
- **Analytics** ← Diagnostics > Crash Data + Other Diagnostic Data only
- **Product Personalisation** ← Usage Data > Product Interaction only
- **Developer's Advertising or Marketing** ← NONE
- **Third-Party Advertising** ← NONE
- **Other Purposes** ← NONE

### Encryption export compliance (App Store Connect → Build → Encryption Compliance)

- Does your app use encryption? **Yes**
- Does your app qualify for any of the exemptions provided in Category 5 Part 2 of the U.S. Export Administration Regulations? **Yes** (uses standard encryption — HTTPS for transport, Fernet for OAuth token storage at rest. Both fall under ECCN 5D992 standard exemption.)
- Self-classification report: not required for standard-encryption-only apps.

### Sign-In requirements

- Does the app require an account to use? **Yes** (must sign up to access any feature beyond the marketing landing page in-app).
- Demo credentials for App Review (REQUIRED — Apple needs this or they reject):
  ```
  Username: appreview-consumer@savorymind.net
  Password: Review-Demo-2026!
  Notes:    Consumer-tier demo account. For restaurant-tier features
            create a separate account with account_type=restaurant
            during signup, or use:
              appreview-restaurant@savorymind.net / Review-Demo-2026!
  ```
  > ⚠ **Action needed:** create both accounts before submission. Don't reuse production accounts.

### Screenshots (App Store)

Required: **6.9" iPhone (1290×2796)** OR **6.5" iPhone (1242×2688)** — at least one of these size classes is mandatory.
Optional: 5.5" iPhone, 12.9" iPad Pro (only if `supportsTablet: true`, which we have).

**Suggested screenshot lineup (5 total, in this order):**

1. **Consumer Dashboard** — show the QUICK grid (Pairings, Music, Recipes, Pantry, Journal, Connect, Order) + the assistant CTA card. Caption: "AI-powered food companion in your pocket."
2. **Sentiment Analysis (restaurant)** — show the populated themes panel with complaint/praise tags + tone breakdown. Caption: "See what guests actually mean, not just star ratings."
3. **Inventory bottom-sheet (restaurant)** — show the +/- and case-pack buttons mid-adjustment with the live delta projection. Caption: "Counting in the cooler, without the spreadsheet."
4. **Beverage Pairings** — show a populated wine pairing card with confidence bar + Top Match badge. Caption: "Pairings backed by AI, with confidence you can read."
5. **Guided Cooking** — show step view with timer running and the inline assistant collapsed at the bottom. Caption: "Help mid-cook when something goes wrong."

> ⚠ **Action needed:** capture these on a real device (legitimacy > simulator) once you have a TestFlight build. Lightly caption in Figma or your tool of choice.

### Age rating questionnaire (App Store)

Answer "None" to every category. The only "Frequent/Intense" risk is "User-Generated Content" — answer **Yes, app contains user-generated content** because of reviews. Then answer **Yes, app has filtering / moderation** if you have any. **No** is also acceptable; rating becomes 4+ either way.

---

## 3. Google Play Console metadata

Many fields overlap with iOS. Where they differ:

### Full description (Play Store, 4000 chars)

Use the same description as App Store. Play Store renders markdown-like line breaks — keep one blank line between paragraphs and bullet groups.

### Promo video URL (optional)

Skip for v1. A 15-30s YouTube video showing the consumer + restaurant flows pays off later but is over-budget for first launch.

### Tags (Play Store has up to 5 categorical tags)

```
food   ·   recipes   ·   restaurants   ·   wine   ·   AI
```

### Data safety form (mandatory, Google Play Console)

Google's exact taxonomy. Same data, slightly different shape from Apple's:

**Data collected:**
- Personal info
  - Name (collected, used for App functionality, NOT shared)
  - Email address (collected, used for App functionality + Account management, NOT shared)
  - User IDs (collected, used for App functionality + Analytics, NOT shared)
- App activity
  - App interactions (collected, used for App functionality + Analytics + Personalization, NOT shared)
  - Other user-generated content (reviews / menu items / inventory adjustments — collected, App functionality, NOT shared)
- Audio/Music — None
- Photos — None (we don't ask for camera permission yet)
- Files & docs — None
- Calendar — None
- Contacts — None
- App info & performance
  - Crash logs (collected, App functionality + Analytics, NOT shared)
  - Diagnostics (collected, App functionality + Analytics, NOT shared)
- Device IDs — None

**Data sharing:** ALL "Not shared" — we don't sell or share data with third-party advertisers / analytics platforms beyond our own service providers (Anthropic / Spotify / Google / Apple / Resend / Sentry / GCP), and Google's data safety form treats service providers as separate from "shared with third parties."

**Security practices:**
- Data is encrypted in transit ✅ (HTTPS)
- Data is encrypted at rest ✅ (Cloud SQL is encrypted by Google; OAuth tokens are Fernet-encrypted)
- Users can request data deletion ✅ (via privacy@savorymind.net per privacy policy)
- App follows Google Play Families Policy ✅ (we're 4+/Everyone, no children-specific concerns)

### Permissions justification (only if any are flagged)

- **INTERNET** ← Required to talk to api.savorymind.net (Auto-granted, no justification needed.)
- **ACCESS_NETWORK_STATE** ← Used to detect offline state and surface helpful errors (auto-granted).

We don't currently request:
- Camera (no barcode scanning yet)
- Location (we use city/country from profile, not GPS)
- Contacts
- Calendar
- Microphone

### Target API level (Google Play requirement)

Expo SDK 55 targets **Android API 35 (Android 15)** — currently meets Play Store's minimum requirement (API 34 minimum as of August 2025, API 35 minimum as of August 2026).

### Internal testing track (recommended pre-production)

Push to internal testing first via:
```sh
cd mobile
eas build --platform android --profile production
eas submit --platform android --latest --track internal
```

Add 2-5 testers (your email + maybe one collaborator). Internal testing is instant; promotion to production is reviewed. Validates the build before public release.

### Closed testing (optional, can skip)

If you want a beta program, configure a closed testing track. Most first-launch apps skip this and go internal → production directly.

---

## 4. Required assets to produce before submission

Both stores have asset requirements that exist outside this doc:

### iOS

- **App icon** at exactly `1024×1024` PNG (no alpha channel, no rounded corners — Apple adds those)
- **iPad-specific screenshots** (only because `supportsTablet: true`) — 12.9" iPad Pro at `2048×2732`
- Five iPhone screenshots at minimum (see lineup above)
- Optional but valuable: an "App Preview" video (15-30s) that auto-plays in App Store search results

### Android

- **Adaptive icon foreground + background** (foreground 432×432 visible area inside 1024×1024 safe zone)
- **Feature graphic** at exactly `1024×500` (the banner that appears at the top of the Play Store listing)
- Phone screenshots (minimum 2, recommended 5-8) at minimum 1080×1920
- Optional: 7" + 10" tablet screenshots (only if you support tablets — we do)

---

## 5. Operator-side actions before any of this is usable

Listed in `SUBMISSION-CHECKLIST.md` (sibling doc). At a glance:

1. Apple Developer Program enrollment ($99/year)
2. Google Play Console enrollment ($25 one-time)
3. Configure Sign in with Apple capability on the bundle ID
4. Create the two App Review demo accounts
5. Produce icons + screenshots + (optional) feature graphic
6. Verify privacy policy + terms are reachable on the deployed frontend
7. Set `APPLE_BUNDLE_ID` env var in deploy workflow + Actions secrets
8. Create scheduler resources (PR #20 runbook, separate from App Store work)
9. Build production binaries via EAS, submit via EAS Submit
10. Wait for store review (typically 1-3 days each)

---

*Drafted: 2026-05-07. Update before every submission — store metadata edits are subject to review for the iOS App Store.*
