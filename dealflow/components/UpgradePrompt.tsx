"use client";

import Link from "next/link";

interface Props {
  title?: string;
  body?: string;
  source?: string;
  variant?: "card" | "inline";
}

export default function UpgradePrompt({
  title = "Upgrade to keep going",
  body = "Pro unlocks unlimited deals plus Claude-generated investment analysis.",
  source = "generic",
  variant = "card",
}: Props) {
  const href = `/pricing?from=${encodeURIComponent(source)}`;

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
        <strong>{title}</strong> {body}{" "}
        <Link href={href} className="underline">
          See plans
        </Link>
      </div>
    );
  }

  return (
    <div className="card border-brand-200 bg-brand-50 p-5">
      <h3 className="font-semibold text-brand-900">{title}</h3>
      <p className="mt-1 text-sm text-brand-900/80">{body}</p>
      <div className="mt-4">
        <Link href={href} className="btn-primary">
          See plans
        </Link>
      </div>
    </div>
  );
}
