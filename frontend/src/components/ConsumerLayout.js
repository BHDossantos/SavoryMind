import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { href: "/consumer/dashboard", label: "Home",    icon: "🏠", match: ["/consumer/dashboard"] },
  { href: "/consumer/explore",   label: "Explore", icon: "✨", match: ["/consumer/explore"] },
  { href: "/consumer/cook",      label: "Cook",    icon: "👨‍🍳", match: ["/consumer/cook", "/consumer/recipes", "/consumer/planner", "/consumer/pantry", "/consumer/guided-cooking"] },
  { href: "/consumer/order",     label: "Order",   icon: "🛵", match: ["/consumer/order"] },
  { href: "/consumer/profile",   label: "Profile", icon: "👤", match: ["/consumer/profile", "/consumer/social"] },
];

export default function ConsumerLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const firstName = user?.first_name || user?.display_name?.split(" ")[0] || "Chef";

  return (
    <div className="min-h-screen flex" style={{ background: "#faf7ff" }}>
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-consumer-100 flex flex-col shadow-sm">
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
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((link) => {
            const active = link.match.some((m) => router.pathname === m || router.pathname.startsWith(m + "/"));
            return (
              <Link key={link.href} href={link.href}
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
        </nav>

        {/* Quick links — utility pages still accessible */}
        <div className="px-4 pb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 mb-1">More</p>
          {[
            { href: "/consumer/pantry",    label: "My Pantry",       icon: "🧺" },
            { href: "/consumer/journal",   label: "Food Journal",    icon: "📔" },
            { href: "/consumer/assistant", label: "Culinary Help",   icon: "👨‍🍳" },
            { href: "/consumer/wine",      label: "Wine Pairing",    icon: "🍷" },
            { href: "/consumer/music",     label: "Music Mood",      icon: "🎵" },
            { href: "/consumer/beverages", label: "Beverages",       icon: "🥂" },
            { href: "/consumer/social",    label: "Connect Apps",    icon: "🔗" },
          ].map((link) => (
            <Link key={link.href} href={link.href}
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

        {/* Footer */}
        <div className="p-4 border-t border-consumer-100 space-y-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-consumer-50">
            <span className="text-xs text-consumer-600 font-medium">Food Lover</span>
            <span className="ml-auto text-xs bg-consumer-500 text-white px-2 py-0.5 rounded-full">Free</span>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <span>🚪</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
