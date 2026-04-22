import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

const homeFeatures = [
  { icon: "🍷", title: "Wine, Beer & Spirits Pairing", desc: "From a bold Cabernet to a hoppy IPA or a smoky Mezcal — the right pour for whatever's on your plate tonight." },
  { icon: "🎵", title: "Music Mood Engine", desc: "Tell us how you're feeling and we'll set the mood — the right sounds for your Sunday morning eggs or Friday night feast." },
  { icon: "👨‍🍳", title: "Recipe Discovery", desc: "Not sure what to cook? Browse recipes matched to your mood, your cuisine, your craving." },
  { icon: "🔗", title: "Stream Anywhere", desc: "Tap once and your dining soundtrack plays — Spotify, Amazon Music, or Alexa, completely hands-free." },
];

const dinerFeatures = [
  { icon: "📅", title: "Book a Table", desc: "Reserve your spot and show up ready to enjoy every second — specify your party, time, and any special requests." },
  { icon: "📖", title: "Visit History", desc: "Write your own dining journal — what you loved, who served you well, whether you'd go back." },
  { icon: "⭐", title: "Rate Everything", desc: "Your honest take on every visit — food, service, atmosphere — so you never forget what made the night." },
  { icon: "💎", title: "Your Dining Profile", desc: "The more you dine, the better you know yourself. Your profile tells your food story." },
];

const restaurantFeatures = [
  { icon: "💰", title: "P&L Dashboard", desc: "See your numbers clearly — what's selling, what's costing you, what's worth celebrating." },
  { icon: "🗑️", title: "Food Waste Tracker", desc: "Know exactly what's being wasted, and stop watching money walk out the back door." },
  { icon: "⏱️", title: "Kitchen Time Tracking", desc: "Find where your kitchen slows down — and help your team get back their rhythm." },
  { icon: "🎓", title: "Staff Training Insights", desc: "Pinpoint exactly where each person needs support, based on real performance data — not guesswork." },
  { icon: "👥", title: "CRM & Loyalty", desc: "Remember every regular. Know what they order, how often they come back, and what makes them feel at home." },
  { icon: "🔮", title: "Sales Predictions", desc: "Know what's likely to sell in the next few hours, before the rush hits." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.account_type === "consumer") router.replace("/consumer/dashboard");
      else if (user.account_type === "diner") router.replace("/diner/dashboard");
      else router.replace("/dashboard");
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
            <span className="text-xl font-bold bg-gradient-to-r from-brand-600 via-diner-500 to-consumer-600 bg-clip-text text-transparent">
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
          <span>✨</span> For cooks. For diners. For restaurants.
        </div>
        <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-5">
          Every meal has a story.
          <br />
          <span className="bg-gradient-to-r from-brand-500 via-diner-500 to-consumer-500 bg-clip-text text-transparent">
            Yours starts here.
          </span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-16">
          Whether you're in the kitchen, at the table, or behind the pass — SavoryMind is built around your relationship with food.
        </p>

        {/* Three mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Consumer */}
          <div className="bg-gradient-to-br from-consumer-50 to-consumer-100 border border-consumer-200 rounded-3xl p-7 text-left hover:shadow-xl hover:shadow-consumer-100 transition-all group">
            <div className="text-4xl mb-4">🏠</div>
            <h2 className="text-xl font-bold text-consumer-800 mb-2">For Culinary Enthusiasts</h2>
            <p className="text-consumer-700 text-sm leading-relaxed mb-5">
              Find the perfect wine for tonight's dish. Set a playlist that matches the mood. Cook something new. Your kitchen, elevated.
            </p>
            <ul className="space-y-1.5 mb-7">
              {["Wine, beer & spirits pairing", "Music mood by food & vibe", "Recipe discovery engine", "Spotify + Amazon + Alexa"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-consumer-800">
                  <span className="text-consumer-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=consumer"
              className="block text-center bg-consumer-600 text-white font-bold py-3 rounded-2xl hover:bg-consumer-700 transition-colors text-sm">
              Join as Culinary Enthusiast →
            </Link>
          </div>

          {/* Diner */}
          <div className="bg-gradient-to-br from-diner-50 to-diner-100 border border-diner-200 rounded-3xl p-7 text-left hover:shadow-xl hover:shadow-diner-100 transition-all group">
            <div className="text-4xl mb-4">🍽️</div>
            <h2 className="text-xl font-bold text-diner-800 mb-2">For Food Connoisseurs</h2>
            <p className="text-diner-700 text-sm leading-relaxed mb-5">
              Remember every great meal. Book the next one. Build a dining history as personal as your taste.
            </p>
            <ul className="space-y-1.5 mb-7">
              {["Book tables at restaurants", "Log orders & rate each visit", "Track staff friendliness", "Personal dining history"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-diner-800">
                  <span className="text-diner-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=diner"
              className="block text-center bg-diner-600 text-white font-bold py-3 rounded-2xl hover:bg-diner-700 transition-colors text-sm">
              Join as Food Connoisseur →
            </Link>
          </div>

          {/* Restaurant */}
          <div className="bg-gradient-to-br from-brand-50 to-orange-100 border border-brand-200 rounded-3xl p-7 text-left hover:shadow-xl hover:shadow-brand-100 transition-all group">
            <div className="text-4xl mb-4">🏪</div>
            <h2 className="text-xl font-bold text-brand-800 mb-2">For Restaurant Owners</h2>
            <p className="text-brand-700 text-sm leading-relaxed mb-5">
              You built this with your hands. Now see exactly what's working — your margins, your team, your guests — all in one place.
            </p>
            <ul className="space-y-1.5 mb-7">
              {["Food waste & kitchen time tracking", "Staff performance & training insights", "CRM & customer loyalty", "Sales forecasting & demand planning"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-brand-800">
                  <span className="text-brand-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=restaurant"
              className="block text-center bg-brand-600 text-white font-bold py-3 rounded-2xl hover:bg-brand-700 transition-colors text-sm">
              Join as Restaurant →
            </Link>
          </div>
        </div>
      </section>

      {/* Home Cook features */}
      <section className="bg-gradient-to-br from-consumer-50 to-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-consumer-100 text-consumer-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🏠 Culinary Enthusiast Mode</div>
            <h2 className="text-3xl font-bold text-gray-900">The right wine. The right song. The right recipe.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {homeFeatures.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-consumer-100 hover:border-consumer-300 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diner features */}
      <section className="bg-gradient-to-br from-diner-50 to-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-diner-100 text-diner-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🍽️ Food Connoisseur Mode</div>
            <h2 className="text-3xl font-bold text-gray-900">Every table deserves to be remembered.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {dinerFeatures.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-diner-100 hover:border-diner-300 hover:shadow-md transition-all">
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
            <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🏪 Restaurant Mode</div>
            <h2 className="text-3xl font-bold text-gray-900">Built for people who pour their life into their restaurant.</h2>
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
        <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Your table is set.</h2>
        <p className="text-gray-500 text-lg mb-10">Free to start. Pick your path and we'll do the rest.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
          <Link href="/signup?type=consumer" className="bg-consumer-600 text-white font-bold px-7 py-4 rounded-xl hover:bg-consumer-700 transition-colors shadow-lg shadow-consumer-100">
            🏠 Culinary Enthusiast
          </Link>
          <Link href="/signup?type=diner" className="bg-diner-600 text-white font-bold px-7 py-4 rounded-xl hover:bg-diner-700 transition-colors shadow-lg shadow-diner-100">
            🍽️ Food Connoisseur
          </Link>
          <Link href="/signup?type=restaurant" className="bg-brand-500 text-white font-bold px-7 py-4 rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-100">
            🏪 I Run a Restaurant
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold text-gray-700">SavoryMind</span>
          </div>
          <p className="text-xs text-gray-400">© 2024 SavoryMind — Food. Drink. Dining.</p>
        </div>
      </footer>
    </div>
  );
}
