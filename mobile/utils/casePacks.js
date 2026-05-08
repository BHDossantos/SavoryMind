/**
 * Quick-adjust case-pack mapping. Maps an item's `unit` to a default
 * case size for the +/- case buttons in the counting bottom sheet.
 *
 * Defaults are the common-sense ones for restaurant supply chains —
 * a future per-item `case_size` column would override these. Not v1.
 */
const CASE_PACKS = {
  bottles: 12,
  cases:   1,
  kg:      1,
  lbs:     1,
  each:    1,
  liters:  1,
};


export function casePackFor(unit) {
  if (!unit) return 1;
  return CASE_PACKS[unit.toLowerCase()] ?? 1;
}
