import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import LanguageSelector from "./LanguageSelector";

const navLinks = [
  { href: "/diner/dashboard",  label: "Home",         icon: "🏠" },
  { href: "/diner/discover",   label: "Discover",     icon: "🔍" },
  { href: "/diner/book",       label: "Book a Table", icon: "📅" },
  { href: "/diner/history",    label: "My Visits",    icon: "📖" },
  { href: "/diner/profile",    label: "Profile",      icon: "👤" },
];

export default function DinerLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showBell, setShowBell]           = useState(false);
  const bellRef = useRef(null);

  const fetchNotifications = () => {
    api.getNotifications().then(setNotifications).catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBellClick = async () => {
    const wasOpen = showBell;
    setShowBell((v) => !v);
    if (!wasOpen && notifications.length > 0) {
      await api.markNotificationsRead().catch(() => {});
      setTimeout(() => setNotifications([]), 3000);
    }
  };

  const sidebarContent = (
    <aside className={clsx(
      "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-diner-100 flex flex-col shadow-sm transition-transform duration-200",
      "md:relative md:translate-x-0 md:z-auto",
      sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      <div className="p-6 border-b border-diner-100 bg-gradient-to-br from-diner-600 to-diner-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-white">SavoryMind</span>
          </div>
          {/* Notification bell */}
          <div ref={bellRef} className="relative">
            <button onClick={handleBellClick} className="relative text-white hover:text-diner-200 transition-colors">
              <span className="text-lg">🔔</span>
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            {showBell && (
              <div className="absolute right-0 top-8 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Notifications</p>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">All caught up!</p>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="px-4 py-3 hover:bg-gray-50">
                        <p className="text-sm text-gray-800">{n.message}</p>
                        {n.link && (
                          <Link href={n.link} className="text-xs text-diner-600 font-medium hover:underline mt-0.5 block"
                            onClick={() => setShowBell(false)}>
                            View →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
            onClick={() => setSidebarOpen(false)}
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
        <Link href="/diner/welcome"
          onClick={() => setSidebarOpen(false)}
          className={clsx(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            router.pathname === "/diner/welcome"
              ? "bg-diner-100 text-diner-700"
              : "text-diner-500 hover:bg-diner-50 hover:text-diner-700"
          )}>
          <span>🎯</span> Getting Started
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-diner-50">
          <span className="text-xs text-diner-600 font-medium">{t("nav.foodExplorer")}</span>
          <span className="ml-auto text-xs bg-diner-500 text-white px-2 py-0.5 rounded-full">Free</span>
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
    <div className="min-h-screen flex" style={{ background: "#f0fdfa" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {sidebarContent}

      {/* Main */}
      <main className="flex-1 overflow-auto min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-diner-100 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-diner-50 text-diner-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-diner-900 text-sm">🧠 SavoryMind</span>
        </div>
        <div className="max-w-7xl mx-auto p-4 md:p-8 w-full">{children}</div>
      </main>
    </div>
  );
}
