"use client";

import Link from "next/link";
import { useBillingSource } from "@/lib/client/use-billing";

const STYLE = {
  free: "bg-slate-100 text-slate-700 ring-slate-200",
  pro: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  team: "bg-brand-100 text-brand-800 ring-brand-200",
} as const;

const LABEL = {
  free: "Free",
  pro: "Pro",
  team: "Team",
} as const;

export default function PlanBadge() {
  const { data, authed, isLoading } = useBillingSource();
  if (!authed || isLoading) return null;
  const tier = data.effectiveTier;
  return (
    <Link
      href="/settings/billing"
      className={`hidden items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 sm:inline-flex ${STYLE[tier]}`}
      title="Manage billing"
    >
      {LABEL[tier]}
    </Link>
  );
}
