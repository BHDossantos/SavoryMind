"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import { dealsRepo } from "@/lib/storage";
import { dealsKey } from "@/lib/client/api";
import { importLocalDealsToApi } from "@/lib/client/import";

const DISMISS_KEY = "dealflow.importBanner.dismissed.v1";

export default function ImportLocalBanner() {
  const { status } = useSession();
  const { mutate } = useSWRConfig();
  const [localCount, setLocalCount] = useState(0);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    try {
      const isDismissed =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(DISMISS_KEY) === "1";
      setDismissed(isDismissed);
      setLocalCount(dealsRepo.list().length);
    } catch {
      setDismissed(false);
    }
  }, [status]);

  if (status !== "authenticated") return null;
  if (dismissed) return null;
  if (localCount === 0 && !result) return null;

  async function runImport() {
    setBusy(true);
    setResult(null);
    try {
      const local = dealsRepo.list();
      const { imported, failed } = await importLocalDealsToApi(local);
      setLocalCount(dealsRepo.list().length);
      await mutate(dealsKey);
      if (failed.length === 0) {
        setResult(`Imported ${imported.length} deal${imported.length === 1 ? "" : "s"}.`);
      } else {
        setResult(
          `Imported ${imported.length}, failed ${failed.length}. Failed deals stay in this browser.`,
        );
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage might be unavailable; silently OK
    }
    setDismissed(true);
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-brand-900">
          <strong>You have {localCount} deal{localCount === 1 ? "" : "s"} saved in this browser.</strong>{" "}
          Import them to your account so they sync across devices.
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={dismiss}
            disabled={busy}
          >
            Not now
          </button>
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={runImport}
            disabled={busy || localCount === 0}
          >
            {busy ? "Importing…" : `Import ${localCount}`}
          </button>
        </div>
      </div>
      {result && (
        <div className="mt-3 text-xs text-brand-900">{result}</div>
      )}
    </div>
  );
}
