/**
 * Carries a guest's taste answers from the public wedge pages
 * (/discover/mood, /discover/menu) into onboarding after signup.
 *
 * The #1 conversion killer in the wedge → signup funnel is asking the
 * same questions twice: the guest just told us their cuisines and
 * dietary needs on the wedge page, and onboarding asks again. Stash
 * the answers in localStorage when they tap the signup CTA; onboarding
 * consumes (and clears) the stash on mount and pre-selects those chips.
 *
 * TTL of 1 hour — if they wander off and sign up next week, stale
 * answers shouldn't silently pre-fill.
 */

const KEY = "savorymind.wedge_taste";
const TTL_MS = 60 * 60 * 1000;

export function stashWedgeTaste({ cuisines = [], dietary = [] } = {}) {
  if (!cuisines.length && !dietary.length) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cuisines,
      dietary,
      at: Date.now(),
    }));
  } catch {
    // Private mode etc. — pre-fill is best-effort.
  }
}

export function consumeWedgeTaste() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - (parsed.at || 0) > TTL_MS) return null;
    return {
      cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines : [],
      dietary:  Array.isArray(parsed.dietary)  ? parsed.dietary  : [],
    };
  } catch {
    return null;
  }
}
