/**
 * Shared formatting helpers. Used everywhere we render a date or time
 * to the user — operators reading "2026-06-15" all day is exactly the
 * kind of friction Italian/French/Spanish restaurants notice within
 * minutes. Always pass the current i18n.language as the second arg so
 * the format follows the user's chosen locale, not the browser default.
 */

export function fmtDate(iso, locale) {
  if (!iso) return "";
  try {
    // `iso` is typically "YYYY-MM-DD" from the API; anchor to local
    // midnight so a date-only string doesn't cross a TZ boundary.
    const s = String(iso);
    const d = s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(locale || undefined, {
      weekday: "short",
      day:     "numeric",
      month:   "short",
    });
  } catch {
    return String(iso);
  }
}

export function fmtDateShort(iso, locale) {
  if (!iso) return "";
  try {
    const s = String(iso);
    const d = s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(locale || undefined);
  } catch {
    return String(iso);
  }
}
