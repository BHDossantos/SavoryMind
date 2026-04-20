import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";

const navLinks = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/menu", label: "Menu Analysis", icon: "🍽️" },
  { href: "/sentiment", label: "Sentiment", icon: "💬" },
  { href: "/recommendations", label: "Recommendations", icon: "✨" },
  { href: "/reports", label: "Reports", icon: "📋" },
];

export default function Layout({ children }) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-brand-600">SavoryMind</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">AI Food Intelligence</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
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
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
