# Nocturna · Store listing copy

Paste-ready metadata for App Store Connect and Google Play Console.
EN is the primary listing; IT is the localized listing for Italy.

---

## Identity

| Field | Value |
|---|---|
| App name (both stores) | **Nocturna** |
| iOS subtitle (30 chars max) | `Plan your perfect night out` |
| Play short description (80 chars max) | `Curated dinner → bar → club plans, reservations & VIP tables in seconds.` |
| Bundle ID / package | `app.nocturna.mobile` |
| Category (iOS) | Lifestyle (secondary: Food & Drink) |
| Category (Play) | Lifestyle |
| Price | Free (in-app purchases: concierge fees + premium subscription) |
| Age rating | 17+ / Mature — references to alcohol (bars, clubs). No gambling, no UGC feeds. |
| Support URL | https://YOUR-WEB-URL/welcome |
| Marketing URL | https://YOUR-WEB-URL |
| Privacy policy URL (required by both stores) | https://YOUR-WEB-URL/privacy |

## Keywords (iOS — 100 chars, comma-separated, no spaces)

```
nightlife,club,rome,date night,cocktail bar,VIP table,aperitivo,restaurant,reservation,night out
```

## Full description — EN (both stores)

```
Where should we go tonight?

Nocturna answers that question in seconds. Tell us your vibe, your budget,
and who you're with — we curate a complete night out: dinner → cocktail
bar → club, matched to how you actually want the night to feel.

WHAT NOCTURNA DOES
• Curated plans, not endless lists — 1 to 3 complete itineraries, never 50 tabs
• Every plan is time-aware: dinner at 8:30, speakeasy at 10:30, club after midnight
• Real venues with real details — dress codes, reservation rules, best arrival times
• One tap books the whole night — we confirm each stop and send you calendar invites
• VIP tables and guest lists handled by our concierge
• Group voting — let your friends pick the plan democratically
• Near Me — see what's open around you right now
• Save favourites, share plans, leave feedback that makes tomorrow's plans smarter

CITIES
Rome today — Milan, Barcelona, Paris, Lisbon, Miami, New York, Dubai,
Mykonos and Ibiza rolling out next.

WHO IT'S FOR
Tourists who don't know the city. Locals bored of the same five places.
Couples planning a date that actually lands. Groups who can never agree.
Anyone who wants tonight handled.

Your perfect night, planned in seconds.
```

## Full description — IT

```
Dove andiamo stasera?

Nocturna risponde in pochi secondi. Dicci il tuo vibe, il tuo budget e chi
viene con te — creiamo una serata completa: cena → cocktail bar → club,
su misura per come vuoi che sia la notte.

COSA FA NOCTURNA
• Piani curati, non liste infinite — da 1 a 3 itinerari completi, mai 50 schede
• Ogni piano rispetta gli orari giusti: cena alle 20:30, speakeasy alle 22:30, club dopo mezzanotte
• Locali veri con dettagli veri — dress code, prenotazioni, orario ideale di arrivo
• Un tap prenota tutta la serata — confermiamo ogni tappa e ti mandiamo gli inviti calendario
• Tavoli VIP e liste gestiti dal nostro concierge
• Votazione di gruppo — lascia che i tuoi amici scelgano il piano
• Vicino a me — scopri cosa è aperto intorno a te adesso
• Salva i preferiti, condividi i piani, lascia feedback che rende i prossimi piani più intelligenti

CITTÀ
Roma oggi — Milano, Barcellona, Parigi, Lisbona, Miami, New York, Dubai,
Mykonos e Ibiza in arrivo.

La tua serata perfetta, pianificata in pochi secondi.
```

## Screenshots to capture (6.7" iPhone + Pixel; use preview build)

1. Home — "Where should we go tonight?" hero + quick intents
2. Planner — vibe picker step
3. Results — plan card with timeline + map
4. Venue detail — photos + dress code + VIP CTA
5. Booking status board — confirmed stops
6. Concierge chat

Required sizes: iOS 6.7" (1290×2796) + 6.5" (1284×2778); Play phone
(1080×1920 or larger, 16:9–2:1) + 1024×500 feature graphic.

## Review notes (paste into both consoles — REQUIRED to avoid rejection)

```
Demo account for review:
  email:    review@nocturna.app
  password: <create this account and paste its password here>

Nocturna is a nightlife planning + reservation-request app. Bookings are
requests fulfilled by our concierge team; no financial transaction is
required to use the core app. In-app purchases cover optional concierge
fees and a premium subscription (Stripe).

Location is used only in-foreground to rank venues by distance ("Near Me"
and planner). Notifications are used for booking confirmations and
reminders.
```

## Play Data Safety / iOS App Privacy answers

| Data | Collected? | Linked to identity | Purpose |
|---|---|---|---|
| Email address | Yes | Yes | Account, booking confirmations |
| Phone number | Yes (optional) | Yes | Booking SMS confirmations |
| Name | Yes (optional) | Yes | Bookings |
| Precise location | Yes (optional, in-use only) | No | Venue ranking; never stored server-side |
| Product interaction (analytics) | Yes (PostHog) | No (pseudonymous) | Analytics |
| Purchase history | Yes (Stripe) | Yes | Payments, receipts |
| Photos / contacts / mic | **No** | — | — |

Data is encrypted in transit (HTTPS). Users can request deletion via
privacy@nocturna.app (declare "account deletion" in Play's form; Apple
requires an in-app deletion path for account-based apps — see
STORE_SUBMISSION.md §Account deletion before submitting).
