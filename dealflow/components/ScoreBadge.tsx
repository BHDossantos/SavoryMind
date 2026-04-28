interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function scoreColor(score: number) {
  if (score >= 75) return { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-200" };
  if (score >= 55) return { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-200" };
  return { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-200" };
}

export function scoreLabel(score: number) {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Decent";
  if (score >= 35) return "Weak";
  return "Avoid";
}

export default function ScoreBadge({ score, size = "md" }: Props) {
  const c = scoreColor(score);
  const sz =
    size === "lg"
      ? "h-20 w-20 text-2xl"
      : size === "sm"
        ? "h-10 w-10 text-sm"
        : "h-14 w-14 text-lg";
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid place-items-center rounded-full font-semibold ring-4 ${c.bg} ${c.text} ${c.ring} ${sz}`}
      >
        {score}
      </div>
      <div>
        <div className={`text-sm font-medium ${c.text}`}>{scoreLabel(score)}</div>
        <div className="text-xs text-slate-500">Deal score</div>
      </div>
    </div>
  );
}
