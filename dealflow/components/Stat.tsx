interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn";
}

const TONES = {
  default: "text-slate-900",
  good: "text-emerald-700",
  bad: "text-rose-700",
  warn: "text-amber-700",
};

export default function Stat({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${TONES[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
