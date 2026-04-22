import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { href: "/consumer/dashboard", label: "Home",        icon: "🏠" },
  { href: "/consumer/recipes",   label: "Recipes",     icon: "👨‍🍳" },
  { href: "/consumer/planner",   label: "Meal Planner",icon: "📅" },
  { href: "/consumer/wine",      label: "Wine Pairing",icon: "🍷" },
  { href: "/consumer/music",     label: "Music Mood",  icon: "🎵" },
  { href: "/consumer/beverages", label: "Beverages",   icon: "🍺" },
  { href: "/consumer/profile",   label: "My Profile",  icon: "👤" },
  { href: "/consumer/social",    label: "Connect",     icon: "🔗" },
];

export default function ConsumerLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex" style={{ background: "#faf7ff" }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-consumer-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-consumer-100 bg-gradient-to-br from-consumer-600 to-consumer-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-white">SavoryMind</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-consumer-400 flex items-center justify-center text-white text-sm font-bold">
              {user?.display_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
              <p className="text-xs text-consumer-200 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                router.pathname === link.href
                  ? "bg-consumer-100 text-consumer-700 shadow-sm"
                  : "text-gray-600 hover:bg-consumer-50 hover:text-consumer-700"
              )}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-consumer-100 space-y-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-consumer-50">
            <span className="text-xs text-consumer-600 font-medium">Food Lover Mode</span>
            <span className="ml-auto text-xs bg-consumer-500 text-white px-2 py-0.5 rounded-full">Free</span>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
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
