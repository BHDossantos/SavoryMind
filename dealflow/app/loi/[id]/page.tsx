"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { analyzeDeal } from "@/lib/scoring";
import { defaultLoiInput, generateLoi, type LoiInput } from "@/lib/loi";
import { useDealSource } from "@/lib/client/use-deals";

export default function LoiPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const { deal, isLoading, error } = useDealSource(id);
  const [loi, setLoi] = useState<LoiInput>(defaultLoiInput());

  const text = useMemo(() => {
    if (!deal) return "";
    return generateLoi(deal, analyzeDeal(deal), loi);
  }, [deal, loi]);

  if (isLoading && !deal) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">Loading…</div>
    );
  }

  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        Couldn&rsquo;t load deal: {error.message}.{" "}
        <Link href="/" className="underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="card p-8 text-center text-sm text-slate-600">
        Deal not found.{" "}
        <Link href="/" className="text-brand-600 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  function set<K extends keyof LoiInput>(key: K, value: LoiInput[K]) {
    setLoi((l) => ({ ...l, [key]: value }));
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LOI-${deal!.name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">LOI Generator</h1>
          <p className="mt-1 text-sm text-slate-600">
            For <span className="font-medium">{deal.name}</span> · suggested
            offer auto-filled from analysis.
          </p>
        </div>
        <Link href={`/deals/${deal.id}`} className="btn-ghost">
          ← Back to deal
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Terms</h2>
          <div>
            <label className="label">Buyer name</label>
            <input
              className="input"
              value={loi.buyerName}
              onChange={(e) => set("buyerName", e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="label">Buyer entity (optional)</label>
            <input
              className="input"
              value={loi.buyerEntity || ""}
              onChange={(e) => set("buyerEntity", e.target.value)}
              placeholder="Acme Holdings, Lda."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Earnest money (€)</label>
              <input
                type="number"
                className="input"
                value={loi.earnestMoney || ""}
                onChange={(e) =>
                  set("earnestMoney", Number(e.target.value || 0))
                }
              />
            </div>
            <div>
              <label className="label">Due diligence days</label>
              <input
                type="number"
                className="input"
                value={loi.dueDiligenceDays || ""}
                onChange={(e) =>
                  set("dueDiligenceDays", Number(e.target.value || 0))
                }
              />
            </div>
            <div>
              <label className="label">Closing date</label>
              <input
                type="date"
                className="input"
                value={loi.closingDate}
                onChange={(e) => set("closingDate", e.target.value)}
              />
            </div>
            <label className="flex items-end gap-2 pb-1 text-sm">
              <input
                type="checkbox"
                checked={loi.financingContingency}
                onChange={(e) =>
                  set("financingContingency", e.target.checked)
                }
              />
              Financing contingency
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary" onClick={download} type="button">
              Download .txt
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(text);
              }}
            >
              Copy to clipboard
            </button>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-3">Preview</h2>
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed">
            {text}
          </pre>
        </section>
      </div>
    </div>
  );
}
