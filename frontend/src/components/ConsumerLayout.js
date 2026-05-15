import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import LanguageSelector from "./LanguageSelector";

// "Dine Out" entry added in the unified Food Lover + Food Explorer
// rollout. Routes into the (legacy) /diner/* tree where the
// discover/book/history screens still live.
const NAV = [
  { href: "/consumer/dashboard", label: "Home",     icon: "🏠",    match: ["/consumer/dashboard"] },
  { href: "/consumer/explore",   label: "Explore",  icon: "✨",    match: ["/consumer/explore"] },
  { href: "/consumer/cook",      label: "Cook",     icon: "👨‍🍳", match: ["/consumer/cook", "/consumer/recipes", "/consumer/planner", "/consumer/pantry", "/consumer/guided-cooking"] },
  { href: "/diner/discover",     label: "Dine Out", icon: "🍽️",   match: ["/diner/discover", "/diner/book", "/diner/history", "/diner/restaurant"] },
  { href: "/consumer/order",     label: "Order",    icon: "🛵",    match: ["/consumer/order"] },
  { href: "/consumer/profile",   label: "Profile",  icon: "👤",    match: ["/consumer/profile", "/consumer/social"] },
];

const QUICK_LINKS = [
  { href: "/consumer/assistant", label: "Ask Flavor",      icon: "👨‍🍳" },
  { href: "/consumer/cellar",    label: "Cellar",          icon: "🥂" },
  { href: "/consumer/pantry",    label: "My Pantry",       icon: "🧺" },
  { href: "/consumer/planner",   label: "Meal Planner",    icon: "📅" },
  { href: "/consumer/journal",   label: "Food Journal",    icon: "📔" },
  { href: "/consumer/wine",      label: "Wine Pairing",    icon: "🍷" },
  { href: "/consumer/music",     label: "Music Mood",      icon: "🎵" },
  { href: "/consumer/beverages", label: "Beverages",       icon: "🥂" },
  { href: "/consumer/social",    label: "Connect Apps",    icon: "🔗" },
  { href: "/diner/book",         label: "My Bookings",     icon: "📅" },
  { href: "/diner/history",      label: "Visit History",   icon: "📖" },
];

export default function ConsumerLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "Chef";

  const sidebarContent = (
    <aside className={clsx(
      "fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-consumer-100 flex flex-col shadow-sm transition-transform duration-200",
      "md:relative md:translate-x-0 md:z-auto",
      sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      {/* Brand + user */}
      <div className="p-5 border-b border-consumer-100 bg-gradient-to-br from-consumer-600 to-consumer-800">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🧠</span>
          <span className="text-xl font-bold text-white">SavoryMind</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-consumer-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(user?.first_name?.[0] || user?.display_name?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{firstName}</p>
            <p className="text-xs text-consumer-200 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Main nav — 5 tabs */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV.map((link) => {
          const active = link.match.some((m) => router.pathname === m || router.pathname.startsWith(m + "/"));
          return (
            <Link key={link.href} href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-consumer-100 text-consumer-700 shadow-sm"
                  : "text-gray-600 hover:bg-consumer-50 hover:text-consumer-700"
              )}>
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}

        {/* Quick links */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 mb-1">More</p>
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                router.pathname === link.href
                  ? "bg-consumer-50 text-consumer-700"
                  : "text-gray-400 hover:text-consumer-600 hover:bg-consumer-50"
              )}>
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-consumer-100 space-y-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-consumer-50">
          <span className="text-xs text-consumer-600 font-medium">{t("nav.foodLover")}</span>
          <span className="ml-auto text-xs bg-consumer-500 text-white px-2 py-0.5 rounded-full">Free</span>
        </div>
        <div className="px-1">
          <LanguageSelector />
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <span>🚪</span> {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#faf7ff" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {sidebarContent}

      {/* Main */}
      <main className="flex-1 overflow-auto min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-consumer-100 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-consumer-50 text-consumer-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-consumer-900 text-sm">🧠 SavoryMind</span>
        </div>
        <div className="max-w-7xl mx-auto p-4 md:p-8 w-full">{children}</div>
      </main>
    </div>
  );
}
