import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CATEGORY_LABELS, listMyRequests } from "@/lib/bookings";
import { StatusBadge } from "@/components/StatusBadge";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const all = listMyRequests(session.userId);

  const upcoming = all.filter((r) =>
    ["submitted", "in_review", "searching", "contacting", "needs_approval", "confirmed"].includes(
      r.status,
    ),
  );
  const past = all.filter((r) =>
    ["completed", "failed", "cancelled"].includes(r.status),
  );

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">My bookings</h1>
        <Link href="/book/new" className="btn-accent">New request</Link>
      </div>
      <Section title="Active" rows={upcoming} emptyText="No active requests." />
      <Section title="History" rows={past} emptyText="No past bookings yet." />
    </div>
  );
}

function Section({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: ReturnType<typeof listMyRequests>;
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ink/60">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/bookings/${r.id}`}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4 hover:border-ink/30"
            >
              <div>
                <div className="font-medium">
                  {CATEGORY_LABELS[r.category] ?? r.category}
                  {r.neighborhood ? ` · ${r.neighborhood}` : ""}
                </div>
                <div className="text-sm text-ink/60">
                  {r.date_requested ?? "no date"} {r.time_requested ?? ""} · {r.party_size} pax
                </div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
