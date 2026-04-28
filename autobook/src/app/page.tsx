import Link from "next/link";

const categories = [
  { id: "restaurant", label: "Dinner", emoji: "🍝" },
  { id: "bar", label: "Drinks", emoji: "🍹" },
  { id: "nightlife", label: "Nightlife", emoji: "🪩" },
  { id: "salon", label: "Haircut", emoji: "💈" },
  { id: "fitness", label: "Fitness", emoji: "🥋" },
  { id: "custom", label: "Custom", emoji: "✨" },
];

export default function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Rome · personal booking assistant
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          Tell us what you want.
          <br />
          We book it for you.
        </h1>
        <p className="mx-auto max-w-xl text-ink/70">
          Skip the calling, the language barrier, and the chasing of confirmations.
          AutoBook handles restaurants, bars, salons, gyms, and nightlife — end to end.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/signup" className="btn btn-accent">Book something now</Link>
          <Link href="/login" className="btn btn-secondary">I already have an account</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Popular categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {categories.map((c) => (
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

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["1. Tell us", "Describe what, when, and where. Either in plain text or with a quick form."],
          ["2. We handle it", "Our concierge contacts venues directly — phone, WhatsApp, email — until it's confirmed."],
          ["3. You show up", "You get the address, time, and confirmation name. That's it."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <div className="mb-2 text-sm font-medium text-accent">{title}</div>
            <div className="text-ink/80">{body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
