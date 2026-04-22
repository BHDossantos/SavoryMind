import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { useState, useEffect } from "react";

const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

export default function DinerProfile() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.getDinerSummary().then(setSummary).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">👤 My Profile</h1>
        <p className="text-gray-400 mt-1">Your dining identity at a glance</p>
      </div>

      {/* Profile card */}
      <div className="bg-gradient-to-br from-diner-600 to-diner-800 rounded-3xl p-8 text-white mb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-diner-400 flex items-center justify-center text-4xl font-bold">
            {user?.display_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{user?.display_name}</h2>
            <p className="text-diner-200">{user?.email}</p>
            <span className="inline-block mt-2 text-xs bg-diner-500 px-3 py-1 rounded-full">Diner Member</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Visits", value: summary.total_visits, icon: "🍽️" },
            { label: "Avg Overall", value: summary.avg_overall ? `${summary.avg_overall} ${stars(summary.avg_overall)}` : "—", icon: "⭐" },
            { label: "Avg Food", value: summary.avg_food || "—", icon: "🍴" },
            { label: "Avg Staff", value: summary.avg_staff || "—", icon: "🤝" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-diner-100 shadow-sm">
              <p className="text-2xl">{s.icon}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">📊 Your Dining Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Return rate</span>
                <span className={`font-bold ${summary.return_rate >= 80 ? "text-diner-600" : summary.return_rate >= 60 ? "text-amber-600" : "text-red-500"}`}>
                  {summary.return_rate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total bookings made</span>
                <span className="font-medium text-gray-800">{summary.total_bookings}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Restaurants visited</span>
                <span className="font-medium text-gray-800">{summary.top_restaurants?.length || 0}</span>
              </div>
            </div>
          </div>

          {summary.top_restaurants?.length > 0 && (
            <div className="bg-white rounded-2xl border border-diner-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-4">🏆 Your Top Spots</h3>
              <div className="space-y-2">
                {summary.top_restaurants.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3">
                    <span className="text-lg">{["🥇","🥈","🥉","4️⃣","5️⃣"][i] || "🍽️"}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{r.name}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-diner-500 h-1.5 rounded-full" style={{ width: `${Math.min((r.visits / summary.total_visits) * 100 * 2, 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{r.visits}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
