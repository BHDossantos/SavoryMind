import Link from "next/link";

const CATEGORIES = [
  { slug: "barber", label: "Haircut & beard", emoji: "💈" },
  { slug: "hair_salon", label: "Hair salon", emoji: "✂️" },
  { slug: "nails", label: "Nails", emoji: "💅" },
  { slug: "massage", label: "Massage", emoji: "💆" },
  { slug: "lashes", label: "Lashes", emoji: "👁️" },
  { slug: "brows", label: "Brows", emoji: "🪞" },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          Book local services instantly.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Find barbers, salons, and beauty professionals available now near you. No phone calls.
          No WhatsApp tag. Just open slots and instant booking.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/search?category=barber&available_now=1"
            className="rounded-lg bg-accent px-6 py-3 font-semibold text-white shadow hover:bg-emerald-600"
          >
            Available now
          </Link>
          <Link
            href="/search?category=barber"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold hover:border-slate-400"
          >
            Browse barbers in Rome
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">What do you need?</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/search?category=${c.slug}`}
              className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-ink"
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="mt-2 text-sm font-medium">{c.label}</span>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Launching with barbers in Rome. More categories rolling out next.
        </p>
      </section>
    </div>
  );
}
