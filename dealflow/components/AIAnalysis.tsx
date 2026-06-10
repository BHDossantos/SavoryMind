"use client";

import { useState } from "react";
import {
  clearNarrativeAction,
  setNarrativeAction,
} from "@/lib/client/actions";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useBillingSource } from "@/lib/client/use-billing";
import type { AINarrative, AIVerdict, Deal } from "@/lib/types";

const VERDICT_STYLE: Record<
  AIVerdict,
  { bg: string; text: string; label: string }
> = {
  pursue: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Pursue" },
  negotiate_hard: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    label: "Negotiate hard",
  },
  pass: { bg: "bg-rose-100", text: "text-rose-800", label: "Pass" },
};

interface Props {
  deal: Deal;
  authed: boolean;
  onChange: () => Promise<unknown> | void;
}

export default function AIAnalysis({ deal, authed, onChange }: Props) {
  const { data: billing } = useBillingSource();
  const aiAllowed = billing.limits.aiAnalysis;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const narrative = deal.aiNarrative;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deal),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      await setNarrativeAction(authed, deal.id, json as AINarrative);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function clear() {
    setError(null);
    try {
      await clearNarrativeAction(authed, deal.id);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear");
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">AI deal analysis</h2>
          <p className="mt-1 text-xs text-slate-500">
            Claude Opus 4.7 generates an investment thesis, key concerns,
            negotiation playbook, and due-diligence checklist from the
            financials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {narrative && (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={clear}
              disabled={loading}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={generate}
            disabled={loading || !aiAllowed}
          >
            {loading
              ? "Analyzing…"
              : !aiAllowed
                ? "Pro feature"
                : narrative
                  ? "Regenerate"
                  : "Generate AI analysis"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {!narrative && !loading && !error && !aiAllowed && (
        <div className="mt-4">
          <UpgradePrompt
            title="AI analysis is a Pro feature"
            body="Upgrade to Pro to generate a Claude-written investment thesis, key concerns, negotiation playbook, and due-diligence checklist for this deal."
            source={authed ? "ai_analysis_gate" : "ai_analysis_unauth"}
            variant="inline"
          />
        </div>
      )}

      {!narrative && !loading && !error && aiAllowed && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No AI analysis yet. Click &ldquo;Generate AI analysis&rdquo; to
          produce one.
        </div>
      )}

      {narrative && (
        <div className="mt-5 space-y-5">
          <div className="flex items-start gap-3">
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${VERDICT_STYLE[narrative.verdict].bg} ${VERDICT_STYLE[narrative.verdict].text}`}
            >
              {VERDICT_STYLE[narrative.verdict].label}
            </span>
            <p className="text-sm leading-relaxed">{narrative.thesis}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Key concerns
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {narrative.key_concerns.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-rose-500">▲</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Negotiation playbook
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {narrative.negotiation_playbook.map((p, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="font-medium">{p.point}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        Leverage:
                      </span>{" "}
                      {p.leverage}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Due-diligence checklist
            </h3>
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {narrative.due_diligence_checklist.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand-600">☐</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-slate-400">
            Generated {new Date(narrative.generatedAt).toLocaleString("en-IE")}
          </div>
        </div>
      )}
    </section>
  );
}
