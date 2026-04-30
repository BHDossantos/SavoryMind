"use client";

import { useEffect, useState } from "react";
import {
  api,
  type AdminNotification,
  type NotificationKind,
  type NotificationStatus,
} from "@/lib/api";

const STATUSES: ("all" | NotificationStatus)[] = [
  "all",
  "pending",
  "sent",
  "failed",
  "cancelled",
];

const KINDS: ("all" | NotificationKind)[] = [
  "all",
  "booking_confirmed",
  "reminder_24h",
  "reminder_2h",
  "booking_cancelled",
];

export default function AdminNotificationsPage() {
  const [status, setStatus] = useState<"all" | NotificationStatus>("all");
  const [kind, setKind] = useState<"all" | NotificationKind>("all");
  const [items, setItems] = useState<AdminNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function load() {
    setItems(null);
    api
      .adminNotifications({
        status: status === "all" ? undefined : status,
        kind: kind === "all" ? undefined : kind,
      })
      .then(setItems)
      .catch((e) => setError(String(e.message || e)));
  }

  useEffect(load, [status, kind]);

  async function runNow() {
    setRunning(true);
    try {
      const result = await api.adminRunNotifications();
      alert(`Sent ${result.sent} notification(s)`);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Filter
            label="Status"
            options={STATUSES}
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
          />
          <Filter
            label="Kind"
            options={KINDS}
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
          />
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-slate-400 disabled:opacity-50"
        >
          {running ? "Running…" : "Run scheduler now"}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-slate-500">Loading…</p>}

      {items && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>#</Th>
                <Th>Kind</Th>
                <Th>To</Th>
                <Th>Subject</Th>
                <Th>Status</Th>
                <Th>Scheduled</Th>
                <Th>Sent</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((n) => (
                <tr key={n.id}>
                  <Td>{n.id}</Td>
                  <Td>{n.kind.replace(/_/g, " ")}</Td>
                  <Td>{n.to_address}</Td>
                  <Td className="max-w-md truncate">{n.subject}</Td>
                  <Td>
                    <StatusPill status={n.status} />
                  </Td>
                  <Td>{new Date(n.scheduled_at).toLocaleString("en-GB")}</Td>
                  <Td>{n.sent_at ? new Date(n.sent_at).toLocaleString("en-GB") : "—"}</Td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No notifications.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Filter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 p-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: NotificationStatus }) {
  const styles: Record<NotificationStatus, string> = {
    pending: "bg-slate-100 text-slate-700",
    sent: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-amber-100 text-amber-800",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs ${styles[status]}`}>{status}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
