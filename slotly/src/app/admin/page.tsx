import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CATEGORY_LABELS, adminListQueue } from "@/lib/bookings";
import { StatusBadge } from "@/components/StatusBadge";

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const queue = adminListQueue({
    status: sp.status,
    category: sp.category,
  });

  const counts = countsByStatus(queue);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin queue</h1>
        <p className="text-ink/60">
          {queue.length} request{queue.length === 1 ? "" : "s"} matching the current filter.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        <Stat label="Submitted" value={counts.submitted} />
        <Stat label="Contacting" value={counts.contacting} />
        <Stat label="Needs approval" value={counts.needs_approval} />
        <Stat label="Confirmed" value={counts.confirmed} />
        <Stat label="Failed" value={counts.failed} />
        <Stat label="Cancelled" value={counts.cancelled} />
      </div>

      <FilterBar current={sp} />

      <div className="space-y-2">
        {queue.length === 0 && <p className="text-ink/60">Queue empty.</p>}
        {queue.map((r) => (
          <Link
            key={r.id}
            href={`/admin/requests/${r.id}`}
            className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 hover:border-ink/30"
          >
            <div>
              <div className="font-medium">
                #{r.id} · {CATEGORY_LABELS[r.category] ?? r.category}
                {r.neighborhood ? ` · ${r.neighborhood}` : ""}
                {r.priority !== "normal" && (
                  <span className="ml-2 badge bg-accent/10 text-accent">
                    {r.priority.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-sm text-ink/60">
                {r.user_first_name ?? r.user_email} · {r.date_requested ?? "—"} {r.time_requested ?? ""} · {r.party_size} pax
              </div>
            </div>
            <StatusBadge status={r.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink/50">{label}</div>
    </div>
  );
}

function FilterBar({ current }: { current: { status?: string; category?: string } }) {
  const statuses = [
    "submitted",
    "in_review",
    "searching",
    "contacting",
    "needs_approval",
    "confirmed",
    "failed",
    "cancelled",
    "completed",
  ];
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Link
        href="/admin"
        className={`badge ${!current.status ? "bg-ink text-cream" : "bg-white border border-ink/15"}`}
      >
        all
      </Link>
      {statuses.map((s) => (
        <Link
          key={s}
          href={`/admin?status=${s}`}
          className={`badge ${current.status === s ? "bg-ink text-cream" : "bg-white border border-ink/15"}`}
        >
          {s.replaceAll("_", " ")}
        </Link>
      ))}
    </div>
  );
}

function countsByStatus(rows: Array<{ status: string }>) {
  const c: Record<string, number> = {
    submitted: 0,
    in_review: 0,
    searching: 0,
    contacting: 0,
    needs_approval: 0,
    confirmed: 0,
    failed: 0,
    cancelled: 0,
    completed: 0,
  };
  for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
  return c as Record<keyof typeof c, number>;
}
