"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RequestActions({
  requestId,
  canApprove,
  canCancel,
}: {
  requestId: number;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function call(path: string) {
    setPending(path);
    const res = await fetch(`/api/booking-requests/${requestId}/${path}`, { method: "POST" });
    setPending(null);
    if (res.ok) router.refresh();
    else alert((await res.json().catch(() => ({}))).error ?? "Action failed");
  }

  if (!canApprove && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canApprove && (
        <>
          <button
            onClick={() => call("approve-option")}
            disabled={pending !== null}
            className="btn-accent"
          >
            {pending === "approve-option" ? "…" : "Confirm this option"}
          </button>
          <button
            onClick={() => call("reject-option")}
            disabled={pending !== null}
            className="btn-secondary"
          >
            {pending === "reject-option" ? "…" : "Find another"}
          </button>
        </>
      )}
      {canCancel && (
        <button
          onClick={() => {
            if (confirm("Cancel this request?")) call("cancel");
          }}
          disabled={pending !== null}
          className="btn-secondary"
        >
          Cancel request
        </button>
      )}
    </div>
  );
}
