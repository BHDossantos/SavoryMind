import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: "📊",
    title: "Real-Time Dashboard",
    desc: "Track revenue, profit margins, orders, and top performers across your entire menu at a glance.",
  },
  {
    icon: "💬",
    title: "AI Sentiment Analysis",
    desc: "Powered by VADER — automatically scores every customer review as positive, neutral, or negative.",
  },
  {
    icon: "✨",
    title: "Smart Recommendations",
    desc: "7-rule engine surfaces price increase, promotion, and quality improvement opportunities instantly.",
  },
  {
    icon: "🍽️",
    title: "Menu Intelligence",
    desc: "Visualize margin, revenue, and order velocity for every dish. Edit and manage items in one place.",
  },
  {
    icon: "📋",
    title: "Reports & Export",
    desc: "Category breakdowns, top/bottom performers, sentiment trends by month — export to CSV anytime.",
  },
  {
    icon: "🔒",
    title: "Your Data, Isolated",
    desc: "Each restaurant gets its own private workspace. No cross-contamination of data between accounts.",
  },
];

const testimonials = [
  {
    name: "Sofia Reyes",
    role: "Owner, Bella Vista Bistro",
    text: "SavoryMind showed me my truffle pasta had a 77% margin but barely any orders. One promotion and sales tripled.",
  },
  {
    name: "Marcus Chen",
    role: "Head Chef, The Harbor",
    text: "The sentiment analysis caught that customers loved the flavor but hated portion size. We fixed it in a week.",
  },
  {
    name: "Amara Williams",
    role: "GM, Sunflower Kitchen",
    text: "I used to spend hours in spreadsheets. Now I get the same insight in seconds. It's genuinely a superpower.",
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
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
            <span className="text-xl font-bold text-brand-600">SavoryMind</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-brand-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-600 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>✨</span> AI-powered restaurant intelligence
        </div>
        <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Turn your menu data into
          <span className="text-brand-500"> money</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          SavoryMind analyzes your menu performance, customer sentiment, and sales patterns to
          surface the exact changes that grow your profit — in seconds, not spreadsheets.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-brand-500 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-brand-600 transition-colors text-lg shadow-lg shadow-brand-200"
          >
            Start free today
          </Link>
          <Link
            href="/login"
            className="text-gray-700 font-semibold px-8 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-lg"
          >
            Sign in
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">No credit card required. Your data pre-loaded on signup.</p>
      </section>

      {/* Stats bar */}
      <section className="bg-brand-500 text-white py-10">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { value: "7", label: "AI recommendation rules" },
            { value: "VADER", label: "Sentiment engine" },
            { value: "4", label: "Analytics pages" },
            { value: "100%", label: "Data isolation per restaurant" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold">{s.value}</p>
              <p className="text-brand-100 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need to optimize</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Built for restaurant owners and managers who want data-driven decisions without the data science degree.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-50 rounded-2xl p-6 hover:bg-brand-50 transition-colors group">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-brand-700">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Restaurants already growing</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-700 leading-relaxed mb-4 italic">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
          Ready to grow your restaurant?
        </h2>
        <p className="text-gray-500 text-lg mb-8 max-w-xl mx-auto">
          Sign up in 30 seconds. We'll pre-load sample data so you can explore every feature immediately.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-brand-500 text-white font-bold px-10 py-4 rounded-xl hover:bg-brand-600 transition-colors text-lg shadow-lg shadow-brand-200"
        >
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold text-brand-600">SavoryMind</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 SavoryMind. AI Food Intelligence Platform.</p>
        </div>
      </footer>
    </div>
  );
}
