import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSelector from "../components/LanguageSelector";

// Cook-at-home + dine-out features live in one unified Food Person
// experience now. Listed together so the landing page reflects what
// the actual app does post-unification — one shell, two halves.
const foodPersonFeatures = [
  { icon: "🍷", title: "Wine, Beer & Spirits Pairing", desc: "From a bold Cabernet to a hoppy IPA or a smoky Mezcal — the right pour for whatever's on your plate tonight." },
  { icon: "👨‍🍳", title: "Recipe Discovery", desc: "Not sure what to cook? Browse recipes matched to your mood, your cuisine, your craving." },
  { icon: "🤖", title: "Ask Flavor", desc: "Your AI food assistant — pairings, fixes, substitutions, technique. Anything you'd ask the chef who lives in your phone." },
  { icon: "🎵", title: "Music Mood Engine", desc: "Tell us how you're feeling and we'll set the mood — the right sounds for your Sunday morning eggs or Friday night feast." },
  { icon: "📅", title: "Discover & Book Restaurants", desc: "Find your next great meal out — by mood, cuisine, or budget. Reserve in a tap and show up ready." },
  { icon: "📖", title: "Visit History & Journal", desc: "Write your dining journal — what you loved, who served you well, whether you'd go back." },
  { icon: "⭐", title: "Rate Everything", desc: "Your honest take on every visit — food, service, atmosphere — so you never forget what made the night." },
  { icon: "💎", title: "Your Food Profile", desc: "The more you cook and dine, the more SavoryMind learns what you love. Your profile tells your food story." },
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
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Food Lover + Food Explorer unified — both land on the consumer shell.
      if (user.account_type === "consumer" || user.account_type === "diner") router.replace("/consumer/dashboard");
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
          <div className="flex items-center gap-3">
            <LanguageSelector compact />
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">{t("nav.signIn")}</Link>
            <Link href="/signup" className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — leads with the North Star and two zero-friction doors
          into the wedge experiences. A visitor who saw a shared card
          should be able to try the product in one tap, no signup.
          The account cards (deeper commitment) come after. */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>✨</span> {t("landing.heroBadge")}
        </div>
        <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-5">
          {t("landing.northStar1")}
          <br />
          <span className="bg-gradient-to-r from-brand-500 via-diner-500 to-consumer-500 bg-clip-text text-transparent">
            {t("landing.northStar2")}
          </span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          {t("landing.northStarSub")}
        </p>

        {/* Wedge doors — instant, no account required. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-20">
          <Link href="/discover/mood"
            className="group bg-gradient-to-br from-consumer-600 to-consumer-800 text-white rounded-3xl p-6 text-left hover:shadow-xl hover:shadow-consumer-200 transition-all">
            <div className="text-4xl mb-3">🪄</div>
            <h2 className="text-lg font-bold mb-1">{t("landing.wedgeMoodTitle")}</h2>
            <p className="text-consumer-100 text-sm leading-relaxed mb-4">{t("landing.wedgeMoodSub")}</p>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              {t("landing.wedgeTryFree")} <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </Link>
          <Link href="/discover/menu"
            className="group bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-3xl p-6 text-left hover:shadow-xl hover:shadow-amber-200 transition-all">
            <div className="text-4xl mb-3">📸</div>
            <h2 className="text-lg font-bold mb-1">{t("landing.wedgeMenuTitle")}</h2>
            <p className="text-amber-100 text-sm leading-relaxed mb-4">{t("landing.wedgeMenuSub")}</p>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              {t("landing.wedgeTryFree")} <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </Link>
        </div>

        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">{t("landing.orGoDeeper")}</p>

        {/* Two mode cards — the old Food Lover / Food Explorer split
            was unified into one consumer experience that hosts both
            cook-at-home + go-out features. Restaurant Owner stays
            separate because the mental model + permissions differ. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Food Person (unified consumer) */}
          <div className="bg-gradient-to-br from-consumer-50 via-purple-50 to-diner-50 border border-consumer-200 rounded-3xl p-7 text-left hover:shadow-xl hover:shadow-consumer-100 transition-all group">
            <div className="text-4xl mb-4">🍴</div>
            <h2 className="text-xl font-bold text-consumer-800 mb-2">{t("landing.foodPersonCardTitle")}</h2>
            <p className="text-consumer-700 text-sm leading-relaxed mb-5">
              {t("landing.foodPersonCardSub")}
            </p>
            <ul className="space-y-1.5 mb-7">
              {(t("landing.foodPersonFeatures", { returnObjects: true }) || []).map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-consumer-800">
                  <span className="text-consumer-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=consumer"
              className="block text-center bg-consumer-600 text-white font-bold py-3 rounded-2xl hover:bg-consumer-700 transition-colors text-sm">
              {t("landing.ctaConsumer")}
            </Link>
          </div>

          {/* Restaurant */}
          <div className="bg-gradient-to-br from-brand-50 to-orange-100 border border-brand-200 rounded-3xl p-7 text-left hover:shadow-xl hover:shadow-brand-100 transition-all group">
            <div className="text-4xl mb-4">🏪</div>
            <h2 className="text-xl font-bold text-brand-800 mb-2">{t("landing.restaurantCardTitle")}</h2>
            <p className="text-brand-700 text-sm leading-relaxed mb-5">
              {t("landing.restaurantCardSub")}
            </p>
            <ul className="space-y-1.5 mb-7">
              {(t("landing.restaurantFeatures", { returnObjects: true }) || []).map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-brand-800">
                  <span className="text-brand-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?type=restaurant"
              className="block text-center bg-brand-600 text-white font-bold py-3 rounded-2xl hover:bg-brand-700 transition-colors text-sm">
              {t("landing.ctaRestaurant")}
            </Link>
          </div>
        </div>
      </section>

      {/* Unified Food Person features. Used to be split into two sections
          (Food Lover Mode + Food Explorer Mode) — merged into one to
          match the unified consumer shell the actual app ships. */}
      <section className="bg-gradient-to-br from-consumer-50 via-white to-diner-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-consumer-100 text-consumer-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🍴 {t("landing.featuresSectionBadge")}</div>
            <h2 className="text-3xl font-bold text-gray-900">{t("landing.featuresSectionTitle")}</h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto">{t("landing.featuresSectionSub")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {foodPersonFeatures.map((f) => (
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
            <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">🏪 {t("landing.restaurantSectionBadge")}</div>
            <h2 className="text-3xl font-bold text-gray-900">{t("landing.restaurantSectionTitle")}</h2>
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

      {/* CTA — two paths matching the unified app: Food Person + Restaurant.
          The legacy /signup?type=diner path still works server-side, but
          we don't surface it as a separate front-door choice anymore. */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-4">{t("landing.finalCtaTitle")}</h2>
        <p className="text-gray-500 text-lg mb-10">{t("landing.finalCtaSub")}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
          <Link href="/signup?type=consumer" className="bg-consumer-600 text-white font-bold px-7 py-4 rounded-xl hover:bg-consumer-700 transition-colors shadow-lg shadow-consumer-100">
            {t("landing.finalCtaConsumer")}
          </Link>
          <Link href="/signup?type=restaurant" className="bg-brand-500 text-white font-bold px-7 py-4 rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-100">
            {t("landing.finalCtaRestaurant")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold text-gray-700">SavoryMind</span>
          </div>
          <p className="text-xs text-gray-400">© 2024 SavoryMind — {t("landing.footerTagline")}</p>
        </div>
      </footer>
    </div>
  );
}
