import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

const consumerFeatures = [
  { icon: "🍷", title: "AI Wine Pairing", desc: "Enter any dish and instantly receive 3 expertly matched wines with rationale, regions, and serving guides." },
  { icon: "🎵", title: "Music Mood Engine", desc: "Select your vibe and food type — get personalised genre, artist, and playlist recommendations." },
  { icon: "🔗", title: "Stream Anywhere", desc: "One-tap to Spotify, Amazon Music, or Alexa. Your dining soundtrack, hands-free." },
  { icon: "👤", title: "Your Taste Profile", desc: "The more you use it, the smarter it gets. AI learns your palate and curates recommendations just for you." },
];

const restaurantFeatures = [
  { icon: "📅", title: "Smart Bookings", desc: "Manage reservations with party notes, allergy flags, table assignment, and status tracking." },
  { icon: "👥", title: "CRM & Loyalty", desc: "Know your customers — visit history, spend totals, favourite dishes, VIP flags and notes." },
  { icon: "🧑‍🍳", title: "Staff Performance", desc: "Track ratings, orders handled, avg order value, and punctuality per staff member." },
  { icon: "🔮", title: "AI Sales Predictions", desc: "ML engine forecasts what will sell in the next 4 hours based on day, time, and historical patterns." },
  { icon: "💬", title: "Sentiment Analysis", desc: "VADER AI scores every customer review — spot quality issues before they damage your reputation." },
  { icon: "📋", title: "Full Analytics", desc: "Revenue, margin, top performers, category breakdown, and monthly sentiment trends — with CSV export." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.account_type === "consumer" ? "/consumer/dashboard" : "/dashboard");
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold bg-gradient-to-r from-brand-600 to-consumer-600 bg-clip-text text-transparent">
              SavoryMind
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
            <Link href="/signup" className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>✨</span> Two powerful modes. One platform.
        </div>
        <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-5">
          The AI that knows
          <br />
          <span className="bg-gradient-to-r from-brand-500 to-consumer-500 bg-clip-text text-transparent">
            food, wine & music
          </span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12">
          Whether you're a food lover building your taste profile, or a restaurant owner optimising every shift —
          SavoryMind has a dedicated AI experience for you.
        </p>

        {/* Two mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Consumer */}
          <div className="bg-gradient-to-br from-consumer-50 to-consumer-100 border border-consumer-200 rounded-3xl p-8 text-left hover:shadow-xl hover:shadow-consumer-100 transition-all group">
            <div className="text-4xl mb-4">🍷</div>
            <h2 className="text-2xl font-bold text-consumer-800 mb-2">For Food Lovers</h2>
            <p className="text-consumer-700 text-sm leading-relaxed mb-6">
              Pair your meals with the perfect wine. Set a music mood. Connect Spotify, Amazon Music, or Alexa.
              Build your personal taste profile as the AI learns what you love.
            </p>
            <ul className="space-y-2 mb-8">
              {["AI wine pairing by dish", "Music mood by food & vibe", "Spotify + Amazon Music + Alexa", "Personalised recommendations"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-consumer-800">
                  <span className="text-consumer-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=consumer"
              className="block text-center bg-consumer-600 text-white font-bold py-3.5 rounded-2xl hover:bg-consumer-700 transition-colors group-hover:shadow-lg">
              Join as Food Lover →
            </Link>
          </div>

          {/* Restaurant */}
          <div className="bg-gradient-to-br from-brand-50 to-orange-100 border border-brand-200 rounded-3xl p-8 text-left hover:shadow-xl hover:shadow-brand-100 transition-all group">
            <div className="text-4xl mb-4">🍽️</div>
            <h2 className="text-2xl font-bold text-brand-800 mb-2">For Restaurants</h2>
            <p className="text-brand-700 text-sm leading-relaxed mb-6">
              Manage bookings, know your best customers, track staff performance, and predict what will sell next —
              all powered by AI that learns your restaurant's patterns.
            </p>
            <ul className="space-y-2 mb-8">
              {["Booking & reservation management", "CRM & customer loyalty", "Staff performance tracking", "AI sales predictions"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-brand-800">
                  <span className="text-brand-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=restaurant"
              className="block text-center bg-brand-600 text-white font-bold py-3.5 rounded-2xl hover:bg-brand-700 transition-colors group-hover:shadow-lg">
              Join as Restaurant →
            </Link>
          </div>
        </div>
      </section>

      {/* Consumer features */}
      <section className="bg-gradient-to-br from-consumer-50 to-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-consumer-100 text-consumer-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🍷 Food Lover Mode</div>
            <h2 className="text-3xl font-bold text-gray-900">Your personal food & music intelligence</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {consumerFeatures.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-consumer-100 hover:border-consumer-300 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurant features */}
      <section className="bg-gradient-to-br from-brand-50 to-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🍽️ Restaurant Mode</div>
            <h2 className="text-3xl font-bold text-gray-900">Every tool to run a smarter restaurant</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {restaurantFeatures.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Ready to start?</h2>
        <p className="text-gray-500 text-lg mb-8">Sign up free. Your personalised AI experience activates instantly.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup?type=consumer" className="bg-consumer-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-consumer-700 transition-colors text-base shadow-lg shadow-consumer-100">
            🍷 I'm a Food Lover
          </Link>
          <Link href="/signup?type=restaurant" className="bg-brand-500 text-white font-bold px-8 py-4 rounded-xl hover:bg-brand-600 transition-colors text-base shadow-lg shadow-brand-100">
            🍽️ I Run a Restaurant
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold text-gray-700">SavoryMind</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 SavoryMind — AI Food & Music Intelligence</p>
        </div>
      </footer>
    </div>
  );
}
