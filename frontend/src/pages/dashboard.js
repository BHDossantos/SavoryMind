import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import MetricCard from "../components/MetricCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api } from "../services/api";

const PIE_COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa"];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [sentimentSummary, setSentimentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getDashboardStats(), api.getMenuItems(), api.getSentimentSummary()])
      .then(([s, items, sent]) => {
        setStats(s);
        setMenuItems(items);
        setSentimentSummary(sent);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (error) return <ErrorMessage message={error} />;

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
        { name: "Positive", value: sentimentSummary.positive_count, fill: "#22c55e" },
        { name: "Neutral", value: sentimentSummary.neutral_count, fill: "#94a3b8" },
        { name: "Negative", value: sentimentSummary.negative_count, fill: "#ef4444" },
      ]
    : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your restaurant performance</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Revenue (30 days)"
          value={`$${stats.total_revenue_30_days.toLocaleString()}`}
          icon="💰"
          color="orange"
        />
        <MetricCard
          title="Avg Profit Margin"
          value={`${stats.avg_profit_margin}%`}
          icon="📈"
          color="green"
        />
        <MetricCard
          title="Total Orders"
          value={stats.total_orders_30_days.toLocaleString()}
          subtitle="Last 30 days"
          icon="🛒"
          color="blue"
        />
        <MetricCard
          title="Menu Items"
          value={stats.total_menu_items}
          icon="🍽️"
          color="purple"
        />
        <MetricCard
          title="Avg Rating"
          value={`${stats.avg_rating} / 5`}
          icon="⭐"
          color="orange"
        />
        <MetricCard
          title="Top Performer"
          value={stats.top_performer}
          subtitle="Most ordered item"
          icon="🏆"
          color="green"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bar chart - top items by orders */}
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Top Items by Orders</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topItems} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - category breakdown */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">By Category</h2>
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
          <h2 className="text-base font-semibold text-gray-800 mb-4">Customer Sentiment Overview</h2>
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
                <p className="text-sm text-gray-400">Positive</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{sentimentSummary.neutral_count}</p>
                <p className="text-sm text-gray-400">Neutral</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{sentimentSummary.negative_count}</p>
                <p className="text-sm text-gray-400">Negative</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{sentimentSummary.avg_rating.toFixed(1)}</p>
                <p className="text-sm text-gray-400">Avg Rating</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
