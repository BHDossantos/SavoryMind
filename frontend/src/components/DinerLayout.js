import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { href: "/diner/dashboard",  label: "Home",         icon: "🏠" },
  { href: "/diner/book",       label: "Book a Table", icon: "📅" },
  { href: "/diner/history",    label: "My Visits",    icon: "📖" },
  { href: "/diner/profile",    label: "Profile",      icon: "👤" },
];

export default function DinerLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex" style={{ background: "#f0fdfa" }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-diner-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-diner-100 bg-gradient-to-br from-diner-600 to-diner-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-white">SavoryMind</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-diner-400 flex items-center justify-center text-white text-sm font-bold">
              {user?.display_name?.[0]?.toUpperCase() || "D"}
            </div>
            <div>
              <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
              <p className="text-xs text-diner-200 truncate">{user?.email}</p>
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
                  ? "bg-diner-100 text-diner-700 shadow-sm"
                  : "text-gray-600 hover:bg-diner-50 hover:text-diner-700"
              )}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-diner-100 space-y-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-diner-50">
            <span className="text-xs text-diner-600 font-medium">Diner Mode</span>
            <span className="ml-auto text-xs bg-diner-500 text-white px-2 py-0.5 rounded-full">Free</span>
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
