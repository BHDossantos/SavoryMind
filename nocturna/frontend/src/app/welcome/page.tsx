import Link from 'next/link';

export default function Welcome() {
  return (
    <div className="min-h-[60vh] grid place-items-center text-center">
      <div>
        <p className="label">Nocturna</p>
        <h1 className="font-display text-6xl mt-3">Your perfect night,<br /> planned in seconds.</h1>
        <p className="text-gold-400/70 mt-4 max-w-xl mx-auto">
          From dinner to dancing, we curate the night, book the table, and arrange the VIP — all from one app.
        </p>
        <Link href="/plan/new" className="btn btn-primary mt-8 inline-block">Plan my night</Link>
      </div>
    </div>
  );
}
