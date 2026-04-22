import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from "recharts";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api } from "../services/api";

const TOP_COLOR = "#22c55e";
const BOT_COLOR = "#ef4444";

function exportCSV(menuItems) {
  const headers = ["Name", "Category", "Price", "Cost", "Margin%", "Orders", "Revenue", "Rating"];
  const rows = menuItems.map((i) => [
    `"${i.name}"`, i.category, i.price.toFixed(2), i.cost.toFixed(2),
    i.profit_margin.toFixed(1), i.orders_last_30_days,
    i.revenue_last_30_days.toFixed(2), i.rating.toFixed(1),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "savorymind-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () =>
    Promise.all([api.getReportsSummary(), api.getMenuItems()])
      .then(([r, items]) => { setReport(r); setMenuItems(items); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message="Generating report..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-400 mt-1">
            {report.total_menu_items} menu items · {report.total_reviews} reviews ·
            Price range ${report.price_range_min}–${report.price_range_max}
          </p>
        </div>
        <button onClick={() => exportCSV(menuItems)} className="btn-primary">
          ⬇ Export CSV
        </button>
      </div>

      {/* Category Breakdown Table */}
      <div className="card mb-6 overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Category Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Category", "Items", "Avg Price", "Avg Cost", "Avg Margin", "Total Orders", "Total Revenue", "Avg Rating"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold text-gray-600 text-left last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.category_breakdown.map((cat, i) => (
                <tr key={cat.category} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-4 py-3 font-medium">{cat.category}</td>
                  <td className="px-4 py-3">{cat.item_count}</td>
                  <td className="px-4 py-3">${cat.avg_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">${cat.avg_cost.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${cat.avg_margin >= 60 ? "text-green-600" : cat.avg_margin < 40 ? "text-red-500" : "text-gray-700"}`}>
                      {cat.avg_margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">{cat.total_orders.toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">${cat.total_revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">⭐ {cat.avg_rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top/Bottom Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Top 5 by Revenue</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.top_5_by_revenue} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={TOP_COLOR} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Bottom 5 by Profit Margin</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.bottom_5_by_margin} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, "Margin"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={BOT_COLOR} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sentiment Trend */}
      {report.sentiment_trend.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Sentiment Over Time</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={report.sentiment_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} dot={false} name="Positive" />
              <Line type="monotone" dataKey="neutral" stroke="#94a3b8" strokeWidth={2} dot={false} name="Neutral" />
              <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} dot={false} name="Negative" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
