import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import LanguageSelector from "./LanguageSelector";

// Restaurant sidebar model (P1-MODULES): 6 primary entries + Loss Discovery
// hero + one collapsed "Altri strumenti" group. Labels are i18n keys resolved
// at render so a language switch re-renders them; icons + hrefs stay static.
//
// Single items (Dashboard, Loss Discovery, AI Predictions) have no children.
// Expandable groups have a `lead` route (clicking the header navigates there)
// and `children` shown when the group is active or manually expanded.

const TOP_ITEMS = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: "📊" },
  // Star feature — the money-number flow. Sits right under Dashboard.
  { href: "/restaurant/loss-discovery", labelKey: "nav.lossDiscovery", icon: "💸", highlight: true },
];

const GROUPS_TOP = [
  {
    key: "losses",
    labelKey: "nav.groupLosses",
    icon: "🗑️",
    lead: "/restaurant/waste",
    children: [
      { href: "/restaurant/waste", labelKey: "nav.waste", icon: "🗑️" },
      { href: "/restaurant/inventory", labelKey: "nav.inventory", icon: "📦" },
    ],
  },
  {
    key: "coaching",
    labelKey: "nav.groupCoaching",
    icon: "🧑‍🍳",
    lead: "/restaurant/staff",
    children: [
      { href: "/restaurant/staff", labelKey: "nav.staff", icon: "👥" },
      { href: "/restaurant/stafftime", labelKey: "nav.stafftime", icon: "⏱️" },
      { href: "/restaurant/training", labelKey: "nav.training", icon: "🎓" },
      { href: "/restaurant/employees", labelKey: "nav.employees", icon: "👔" },
      { href: "/restaurant/employee-qr-codes", labelKey: "nav.qrCodes", icon: "🔳" },
    ],
  },
  {
    key: "menu",
    labelKey: "nav.groupMenu",
    icon: "🍽️",
    lead: "/menu",
    children: [
      { href: "/menu", labelKey: "nav.menu", icon: "🍽️" },
      { href: "/recommendations", labelKey: "nav.recommendations", icon: "✨" },
      { href: "/restaurant/trends", labelKey: "nav.trends", icon: "🚀" },
    ],
  },
];

const PREDICTIONS_ITEM = { href: "/restaurant/predictions", labelKey: "nav.predictions", icon: "🔮" };

const SETTINGS_GROUP = {
  key: "settings",
  labelKey: "nav.groupSettings",
  icon: "💳",
  lead: "/restaurant/billing",
  children: [
    { href: "/restaurant/billing", labelKey: "nav.billing", icon: "💳" },
    { href: "/restaurant/integrations", labelKey: "nav.integrations", icon: "🔌" },
  ],
};

// Collapsed "everything else" group. `feature` maps an item to an entitlement
// flag; when that flag is false the item is shown with a 🔒 and routes to the
// billing upgrade path instead of the (locked) feature. Items with no
// `feature` are always available.
const OTHER_TOOLS = [
  { href: "/restaurant/bookings", labelKey: "nav.bookings", icon: "📅", feature: "bookings" },
  { href: "/restaurant/crm", labelKey: "nav.crm", icon: "👥", feature: "crm" },
  { href: "/sentiment", labelKey: "nav.sentiment", icon: "💬", feature: "review_response" },
  { href: "/restaurant/marketing", labelKey: "nav.marketing", icon: "💌", feature: "marketing" },
  { href: "/restaurant/kitchen", labelKey: "nav.kitchen", icon: "⏱️" },
  { href: "/restaurant/operations", labelKey: "nav.operations", icon: "✅" },
  { href: "/restaurant/schedule", labelKey: "nav.schedule", icon: "🗓️" },
  { href: "/reports", labelKey: "nav.reports", icon: "📋", feature: "reports" },
  { href: "/restaurant/assistant", labelKey: "nav.flavor", icon: "👨‍🍳" },
];

const UPGRADE_PATH = "/restaurant/billing";

const ITEM_BASE =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors";
const SUBITEM_BASE =
  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors";
const ACTIVE_CLS = "bg-brand-50 text-brand-700";
const IDLE_CLS = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";

function Chevron({ open, className }) {
  return (
    <svg
      className={clsx("w-4 h-4 transition-transform", open && "rotate-180", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function Layout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Manual expand overrides (not persisted across reload). Active groups
  // auto-expand regardless.
  const [expanded, setExpanded] = useState({});
  const [otherOpen, setOtherOpen] = useState(false);
  const [entitlements, setEntitlements] = useState(null);

  // Feature-flag locks. Default to UNLOCKED on any failure — never hard-block
  // the owner because of a fetch error.
  useEffect(() => {
    let alive = true;
    api
      .getEntitlements()
      .then((data) => { if (alive) setEntitlements(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const isActive = (href) => router.pathname === href;
  const groupActive = (g) =>
    router.pathname === g.lead || g.children.some((c) => router.pathname === c.href);
  const groupOpen = (g) => Boolean(expanded[g.key]) || groupActive(g);
  const toggleGroup = (g) =>
    setExpanded((prev) => ({ ...prev, [g.key]: !groupOpen(g) }));
  const isLocked = (item) => {
    if (!item.feature || !entitlements || !entitlements.features) return false;
    return entitlements.features[item.feature] === false;
  };

  const closeSidebar = () => setSidebarOpen(false);

  const renderTopItem = (item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={closeSidebar}
      className={clsx(
        ITEM_BASE,
        isActive(item.href) ? ACTIVE_CLS : IDLE_CLS,
        item.highlight && !isActive(item.href) && "bg-brand-50/50 ring-1 ring-brand-200"
      )}
    >
      <span>{item.icon}</span>
      {t(item.labelKey)}
    </Link>
  );

  const renderGroup = (g) => {
    const open = groupOpen(g);
    return (
      <div key={g.key}>
        <div className={clsx("flex items-center rounded-lg", groupActive(g) && "bg-brand-50")}>
          <Link
            href={g.lead}
            onClick={closeSidebar}
            className={clsx(
              ITEM_BASE,
              "flex-1",
              groupActive(g) ? ACTIVE_CLS : IDLE_CLS
            )}
          >
            <span>{g.icon}</span>
            {t(g.labelKey)}
          </Link>
          <button
            type="button"
            onClick={() => toggleGroup(g)}
            aria-label={t(g.labelKey)}
            aria-expanded={open}
            className="px-2 py-2.5 text-gray-400 hover:text-gray-700"
          >
            <Chevron open={open} />
          </button>
        </div>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
            {g.children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={closeSidebar}
                className={clsx(SUBITEM_BASE, isActive(c.href) ? ACTIVE_CLS : IDLE_CLS)}
              >
                <span className="text-xs">{c.icon}</span>
                {t(c.labelKey)}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

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
        {TOP_ITEMS.map(renderTopItem)}
        {GROUPS_TOP.map(renderGroup)}
        {renderTopItem(PREDICTIONS_ITEM)}
        {renderGroup(SETTINGS_GROUP)}

        {/* Collapsed "everything else" group — closed by default. */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setOtherOpen((o) => !o)}
            aria-expanded={otherOpen}
            className={clsx(ITEM_BASE, "w-full", IDLE_CLS)}
          >
            <span>🧰</span>
            <span className="flex-1 text-left">{t("nav.otherTools")}</span>
            <Chevron open={otherOpen} />
          </button>
          {otherOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
              {OTHER_TOOLS.map((item) => {
                const locked = isLocked(item);
                const href = locked ? UPGRADE_PATH : item.href;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={closeSidebar}
                    title={locked ? t("nav.upgradeToUnlock") : undefined}
                    className={clsx(
                      SUBITEM_BASE,
                      isActive(item.href) && !locked ? ACTIVE_CLS : IDLE_CLS,
                      locked && "opacity-60"
                    )}
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {locked && <span className="text-xs" aria-hidden>🔒</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
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
