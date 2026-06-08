"use client";

import { useRef, useState } from "react";
import {
  addAttachmentAction,
  removeAttachmentAction,
} from "@/lib/client/actions";
import type { Attachment, Deal } from "@/lib/types";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB across all attachments

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Props {
  deal: Deal;
  authed: boolean;
  onChange: () => Promise<unknown> | void;
}

export default function Attachments({ deal, authed, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attachments = deal.attachments ?? [];
  const totalBytes = attachments.reduce((s, a) => s + a.size, 0);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setBusy(true);
    let current = [...attachments];
    let runningTotal = totalBytes;
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          setError(`${file.name} exceeds the 2 MB per-file limit.`);
          continue;
        }
        if (runningTotal + file.size > MAX_TOTAL_BYTES) {
          setError(
            `Total attachments would exceed the 5 MB limit. Remove a file first.`,
          );
          break;
        }
        const dataUrl = await readAsDataUrl(file);
        const a: Attachment = {
          id: uid(),
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          addedAt: new Date().toISOString(),
        };
        await addAttachmentAction(authed, deal.id, a, current);
        current = [...current, a];
        runningTotal += file.size;
      }
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Attachment) {
    if (!confirm(`Remove ${a.name}?`)) return;
    setBusy(true);
    try {
      await removeAttachmentAction(authed, deal.id, a.id, attachments);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Documents</h2>
          <p className="mt-1 text-xs text-slate-500">
            Attach financials, leases, photos.{" "}
            {authed
              ? "Stored on your account."
              : "Stored locally in your browser."}
            {totalBytes > 0 && <> · {formatSize(totalBytes)} of 5 MB used</>}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "+ Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No documents yet.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-3">
              <div className="min-w-0 flex-1">
                <a
                  href={a.dataUrl}
                  download={a.name}
                  className="block truncate text-sm font-medium text-brand-700 hover:underline"
                >
                  {a.name}
                </a>
                <div className="text-xs text-slate-500">
                  {a.type} · {formatSize(a.size)} ·{" "}
                  {new Date(a.addedAt).toLocaleDateString("en-IE")}
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost text-xs text-rose-700 hover:bg-rose-50"
                disabled={busy}
                onClick={() => remove(a)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
