/**
 * Locale-aware euro formatting for the restaurant side.
 *
 * Italian is the primary market, so the default grouping is the European
 * convention: €1.234,56 (dot thousands, comma decimal). English formats
 * the Anglo way: €1,234.56. All other supported locales (es/pt/fr) use
 * the European convention too.
 *
 * We format by hand rather than lean on Intl.NumberFormat because RN's
 * Hermes engine ships a partial Intl and locale data isn't guaranteed on
 * every device — a manual formatter is deterministic and testable.
 */

// en is the only supported locale that uses comma-thousands / dot-decimal.
const ANGLO = new Set(['en']);

/**
 * Format a number as euros for the given locale.
 *
 * @param {number} amount     value in euros (may be fractional)
 * @param {string} locale     i18n language code (en/it/es/pt/fr)
 * @param {object} [opts]
 * @param {number} [opts.decimals=2]  fraction digits (0 for whole-euro stats)
 * @returns {string} e.g. "€1.234,56" (it) or "€1,234.56" (en)
 */
export function formatEuro(amount, locale = 'it', { decimals = 2 } = {}) {
  const n = Number.isFinite(amount) ? amount : 0;
  const anglo = ANGLO.has(String(locale).toLowerCase().split('-')[0]);
  const thousands = anglo ? ',' : '.';
  const decimal = anglo ? '.' : ',';

  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const body = fracPart ? `${grouped}${decimal}${fracPart}` : grouped;
  return `${n < 0 ? '-' : ''}€${body}`;
}
