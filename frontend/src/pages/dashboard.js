import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import MetricCard from "../components/MetricCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api } from "../services/api";

const PIE_COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa"];

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [sentimentSummary, setSentimentSummary] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true); setError(null);
    Promise.all([
      api.getDashboardStats(),
      api.getMenuItems(),
      api.getSentimentSummary(),
      api.getTodaySummary().catch(() => null),  // tolerated: a brand-new restaurant has no slots yet
      api.getRestaurantBillingStatus().catch(() => null),  // tolerated: billing dormant in dev
    ])
      .then(([s, items, sent, today, bill]) => {
        setStats(s);
        setMenuItems(items);
        setSentimentSummary(sent);
        setTodaySummary(today);
        setBilling(bill);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message={t("restaurantDashboard.loading")} />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const topItems = [...menuItems]
    .sort((a, b) => b.orders_last_30_days - a.orders_last_30_days)
    .slice(0, 6)
    .map((i) => ({ name: i.name.split(" ").slice(0, 2).join(" "), orders: i.orders_last_30_days, revenue: i.revenue_last_30_days }));

  const categoryData = menuItems.reduce((acc, item) => {
    const existing = acc.find((c) => c.name === item.category);
    if (existing) existing.value++;
    else acc.push({ name: item.category, value: 1 });
    return acc;
  }, []);

  const sentimentData = sentimentSummary
    ? [
        { name: t("restaurantDashboard.positive"), value: sentimentSummary.positive_count, fill: "#22c55e" },
        { name: t("restaurantDashboard.neutral"),  value: sentimentSummary.neutral_count,  fill: "#94a3b8" },
        { name: t("restaurantDashboard.negative"), value: sentimentSummary.negative_count, fill: "#ef4444" },
      ]
    : [];

  // Renew nudge: only when the restaurant HAD a subscription that lapsed
  // (past_due / canceled) — never nag a free-pilot restaurant that simply
  // hasn't subscribed yet. Soft banner, never a hard gate.
  const subStatus = billing?.subscription_status;
  const lapsed = !billing?.is_pro && (subStatus === "past_due" || subStatus === "canceled");

  return (
    <div>
      {lapsed && (
        <Link
          href="/restaurant/billing"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
        >
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-900 text-sm">
              {subStatus === "past_due"
                ? t("restaurantDashboard.billingPastDue")
                : t("restaurantDashboard.billingLapsed")}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">{t("restaurantDashboard.billingNudgeSub")}</p>
          </div>
          <span className="text-xs px-3 py-2 rounded-xl bg-amber-600 text-white font-semibold flex-shrink-0">
            {t("restaurantDashboard.billingNudgeCta")}
          </span>
        </Link>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("restaurantDashboard.title")}</h1>
        <p className="text-gray-400 mt-1">{t("restaurantDashboard.subtitle")}</p>
      </div>

      {/* Today's bookings — the most actionable line on the dashboard for a
          restaurant on a typical morning. Tolerates a null summary (brand-new
          account with no bookings yet) by hiding the card. */}
      {todaySummary && (
        <Link
          href="/restaurant/bookings"
          className="mb-6 flex items-center gap-4 rounded-2xl bg-white border border-brand-100 shadow-sm p-5 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <span className="text-4xl flex-shrink-0">📅</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-0.5">
              {t("restaurantDashboard.todayBookings")}
            </p>
            <p className="text-xl font-extrabold text-gray-900">
              {todaySummary.total_bookings === 0
                ? t("restaurantDashboard.noBookingsToday")
                : t("restaurantDashboard.bookingsToday", {
                    count: todaySummary.total_bookings,
                    covers: todaySummary.total_covers,
                  })}
            </p>
            {todaySummary.pending > 0 && (
              <p className="text-sm text-amber-700 font-semibold mt-1">
                {t("restaurantDashboard.pendingCount", { count: todaySummary.pending })}
              </p>
            )}
          </div>
          <span className="text-xs px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold flex-shrink-0">
            {t("restaurantDashboard.manageBookings")}
          </span>
        </Link>
      )}

      {/* Flavor — same AI assistant the consumer side has. Restaurant
          owners get the restaurant-side tool registry. */}
      <Link
        href="/restaurant/assistant"
        className="group mb-8 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-white shadow-sm hover:shadow-md transition-all"
      >
        <span className="text-4xl flex-shrink-0">👨‍🍳</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">{t("restaurantDashboard.askFlavor")}</p>
          <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
            {t("restaurantDashboard.askFlavorSub")}
          </p>
        </div>
        <span className="text-2xl flex-shrink-0 group-hover:translate-x-1 transition-transform">→</span>
      </Link>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title={t("restaurantDashboard.revenue30")}
          value={`$${stats.total_revenue_30_days.toLocaleString()}`}
          icon="💰"
          color="orange"
        />
        <MetricCard
          title={t("restaurantDashboard.avgProfitMargin")}
          value={`${stats.avg_profit_margin}%`}
          icon="📈"
          color="green"
        />
        <MetricCard
          title={t("restaurantDashboard.totalOrders")}
          value={stats.total_orders_30_days.toLocaleString()}
          subtitle={t("restaurantDashboard.last30Days")}
          icon="🛒"
          color="blue"
        />
        <MetricCard
          title={t("restaurantDashboard.menuItems")}
          value={stats.total_menu_items}
          icon="🍽️"
          color="purple"
        />
        <MetricCard
          title={t("restaurantDashboard.avgRating")}
          value={`${stats.avg_rating} / 5`}
          icon="⭐"
          color="orange"
        />
        <MetricCard
          title={t("restaurantDashboard.topPerformer")}
          value={stats.top_performer}
          subtitle={t("restaurantDashboard.mostOrderedItem")}
          icon="🏆"
          color="green"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bar chart - top items by orders */}
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{t("restaurantDashboard.topItemsByOrders")}</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topItems} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} name={t("restaurantDashboard.ordersLabel")} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - category breakdown */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{t("restaurantDashboard.byCategory")}</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sentiment summary */}
      {sentimentSummary && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{t("restaurantDashboard.sentimentOverview")}</h2>
          <div className="flex items-center gap-8">
            <div className="w-40 h-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                    {sentimentData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{sentimentSummary.positive_count}</p>
                <p className="text-sm text-gray-400">{t("restaurantDashboard.positive")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{sentimentSummary.neutral_count}</p>
                <p className="text-sm text-gray-400">{t("restaurantDashboard.neutral")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{sentimentSummary.negative_count}</p>
                <p className="text-sm text-gray-400">{t("restaurantDashboard.negative")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{sentimentSummary.avg_rating.toFixed(1)}</p>
                <p className="text-sm text-gray-400">{t("restaurantDashboard.avgRating")}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
