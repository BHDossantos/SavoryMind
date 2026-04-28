"use client";

interface Props {
  value: number;
  onChange?: (n: number) => void;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-4xl",
};

export default function Stars({ value, onChange, size = "md" }: Props) {
  const interactive = !!onChange;
  return (
    <div className={`inline-flex gap-1 ${SIZES[size]}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const className = `${
          filled ? "text-amber-400" : "text-slate-300"
        } ${interactive ? "cursor-pointer hover:text-amber-500" : ""}`;
        if (interactive) {
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange!(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className={className}
            >
              ★
            </button>
          );
        }
        return (
          <span key={n} className={className}>
            ★
          </span>
        );
      })}
    </div>
  );
}
