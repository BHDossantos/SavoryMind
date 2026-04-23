import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { href: "/dashboard",               label: "Dashboard",       icon: "📊" },
  { href: "/menu",                    label: "Menu Analysis",   icon: "🍽️" },
  { href: "/sentiment",               label: "Sentiment",       icon: "💬" },
  { href: "/recommendations",         label: "Recommendations", icon: "✨" },
  { href: "/reports",                 label: "Reports",         icon: "📋" },
  { href: "/restaurant/bookings",     label: "Bookings",        icon: "📅" },
  { href: "/restaurant/crm",          label: "CRM",             icon: "👥" },
  { href: "/restaurant/staff",        label: "Staff",           icon: "🧑‍🍳" },
  { href: "/restaurant/predictions",  label: "AI Predictions",  icon: "🔮" },
  { href: "/restaurant/trends",       label: "Trends",          icon: "🚀" },
  { href: "/restaurant/marketing",    label: "Marketing",       icon: "💌" },
  { href: "/restaurant/waste",        label: "Food Waste",      icon: "🗑️" },
  { href: "/restaurant/kitchen",      label: "Kitchen Times",   icon: "⏱️" },
  { href: "/restaurant/stafftime",     label: "Staff Time",      icon: "⏱️" },
  { href: "/restaurant/training",     label: "Staff Training",  icon: "🎓" },
  { href: "/restaurant/employees",    label: "Employee Logins", icon: "👔" },
];

export default function Layout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-brand-500 to-brand-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-white">SavoryMind</span>
          </div>
          {user && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
              <p className="text-xs text-orange-200 truncate">{user.email}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                router.pathname === link.href
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50">
            <span className="text-xs text-brand-700 font-medium">Restaurant Mode</span>
            <span className="ml-auto text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">Free</span>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <span>🚪</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
