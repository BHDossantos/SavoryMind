import Link from "next/link";
import { useAuth } from "../context/AuthContext";

// Wraps a Premium-only page. Premium users see the page untouched; free
// users see an upgrade prompt instead. Because the gated page component is
// passed as `children`, it only mounts for Premium users — its data-fetching
// effects never fire a request that would just bounce back a 402.
export default function PremiumGate({ feature, blurb, children }) {
  const { isPremium } = useAuth();
  if (isPremium) return children;

  return (
    <div className="max-w-md mx-auto mt-6 md:mt-12 text-center bg-white rounded-2xl border border-consumer-100 shadow-sm p-8">
      <div className="text-5xl mb-4">🔒</div>
      <span className="inline-block text-xs font-bold uppercase tracking-wide text-consumer-700 bg-consumer-50 rounded-full px-3 py-1 mb-3">
        Premium
      </span>
      <h2 className="text-xl font-bold text-gray-900">{feature}</h2>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
        {blurb || `${feature} is part of SavoryMind Premium.`}
      </p>
      <Link
        href="/consumer/upgrade"
        className="inline-block mt-6 bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors"
      >
        Upgrade to Premium
      </Link>
      <p className="text-xs text-gray-400 mt-3">
        Unlocks the meal planner, wine &amp; beverage pairings, music moods, and the cellar.
      </p>
    </div>
  );
}
