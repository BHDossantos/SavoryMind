import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import LanguageSelector from "./LanguageSelector";

// Nav labels are derived from i18n inside the component so a language
// switch re-renders them. Icons + hrefs stay static.
function useNavLinks() {
  const { t } = useTranslation();
  return [
    { href: "/dashboard",               labelKey: "nav.dashboard",       icon: "📊" },
    { href: "/restaurant/assistant",    labelKey: "nav.flavor",          icon: "👨‍🍳" },
    { href: "/menu",                    labelKey: "nav.menu",            icon: "🍽️" },
    { href: "/sentiment",               labelKey: "nav.sentiment",       icon: "💬" },
    { href: "/recommendations",         labelKey: "nav.recommendations", icon: "✨" },
    { href: "/reports",                 labelKey: "nav.reports",         icon: "📋" },
    { href: "/restaurant/bookings",     labelKey: "nav.bookings",        icon: "📅" },
    { href: "/restaurant/crm",          labelKey: "nav.crm",             icon: "👥" },
    { href: "/restaurant/staff",        labelKey: "nav.staff",           icon: "🧑‍🍳" },
    { href: "/restaurant/predictions",  labelKey: "nav.predictions",     icon: "🔮" },
    { href: "/restaurant/trends",       labelKey: "nav.trends",          icon: "🚀" },
    { href: "/restaurant/marketing",    labelKey: "nav.marketing",       icon: "💌" },
    { href: "/restaurant/waste",        labelKey: "nav.waste",           icon: "🗑️" },
    { href: "/restaurant/inventory",    labelKey: "nav.inventory",       icon: "📦" },
    { href: "/restaurant/kitchen",      labelKey: "nav.kitchen",         icon: "⏱️" },
    { href: "/restaurant/stafftime",    labelKey: "nav.stafftime",       icon: "⏱️" },
    { href: "/restaurant/training",     labelKey: "nav.training",        icon: "🎓" },
    { href: "/restaurant/employees",    labelKey: "nav.employees",       icon: "👔" },
    { href: "/restaurant/employee-qr-codes", labelKey: "nav.qrCodes",   icon: "🔳" },
    { href: "/restaurant/billing",      labelKey: "nav.billing",         icon: "💳" },
  ].map((l) => ({ ...l, label: t(l.labelKey) }));
}

export default function Layout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navLinks = useNavLinks();

  const sidebar = (
    <aside className={clsx(
      "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-200",
      "md:relative md:translate-x-0 md:z-auto",
      "print:hidden",
      sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
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
            onClick={() => setSidebarOpen(false)}
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
          <span className="text-xs text-brand-700 font-medium">{t("nav.restaurantMode")}</span>
          <span className="ml-auto text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">Free</span>
        </div>
        <div className="px-1">
          <LanguageSelector />
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <span>🚪</span> {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {sidebar}

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-20 print:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-gray-900 text-sm">🧠 SavoryMind</span>
        </div>
        <div className="max-w-7xl mx-auto p-4 md:p-8 w-full">{children}</div>
      </main>
    </div>
  );
}
