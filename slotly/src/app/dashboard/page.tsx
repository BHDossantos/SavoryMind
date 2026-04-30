import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listMyRequests, CATEGORY_LABELS } from "@/lib/bookings";
import { StatusBadge } from "@/components/StatusBadge";

const cards = [
  { id: "restaurant", label: "Dinner", emoji: "🍝" },
  { id: "bar", label: "Drinks", emoji: "🍹" },
  { id: "nightlife", label: "Nightlife", emoji: "🪩" },
  { id: "salon", label: "Haircut", emoji: "💈" },
  { id: "fitness", label: "Fitness", emoji: "🥋" },
  { id: "custom", label: "Custom", emoji: "✨" },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const recent = listMyRequests(session.userId).slice(0, 3);
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">What do you want us to book?</h1>
        <p className="text-ink/70">Pick a category, or write what you want in your own words.</p>
        <div className="pt-2">
          <Link href="/book/new" className="btn-accent">Book something for me</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">
          Quick start
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {cards.map((c) => (
            <Link
              key={c.id}
              href={`/book/new?category=${c.id}`}
              className="card flex flex-col items-center justify-center gap-2 text-center hover:border-ink/30"
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-sm font-medium">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink/60">
              Recent requests
            </h2>
            <Link href="/bookings" className="text-sm underline">
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((r) => (
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
        </section>
      )}
    </div>
  );
}
