import type { RiskFlag } from "@/lib/types";

const COLORS: Record<RiskFlag["severity"], string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-orange-50 text-orange-800 border-orange-200",
  critical: "bg-rose-50 text-rose-800 border-rose-200",
};

export default function RiskFlags({ risks }: { risks: RiskFlag[] }) {
  if (risks.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        No major risk flags detected.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {risks.map((r) => (
        <li
          key={r.code}
          className={`rounded-lg border p-3 text-sm ${COLORS[r.severity]}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{r.label}</span>
            <span className="text-xs uppercase tracking-wide opacity-70">
              {r.severity}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}
