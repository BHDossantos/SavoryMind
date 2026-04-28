export function eur(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function years(n: number): string {
  if (!Number.isFinite(n) || n >= 99) return "—";
  return `${n.toFixed(1)} yrs`;
}
