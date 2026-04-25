import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

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

  return (
    <div className="min-h-screen flex" style={{ background: "#f0fdfa" }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-diner-100 flex flex-col shadow-sm">
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
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              router.pathname === "/diner/welcome"
                ? "bg-diner-100 text-diner-700"
                : "text-diner-500 hover:bg-diner-50 hover:text-diner-700"
            )}>
            <span>🎯</span> Getting Started
          </Link>
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
