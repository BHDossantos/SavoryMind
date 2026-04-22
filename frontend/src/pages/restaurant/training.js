import { useState, useEffect } from "react";
import { api } from "../../services/api";

const PRIORITY_STYLES = {
  high: { badge: "bg-red-100 text-red-700", icon: "🚨", border: "border-red-200" },
  medium: { badge: "bg-amber-100 text-amber-700", icon: "⚠️", border: "border-amber-200" },
  low: { badge: "bg-green-100 text-green-700", icon: "✅", border: "border-green-200" },
};

const TYPE_ICONS = {
  waste_reduction: "🗑️",
  speed_coaching: "⏱️",
  performance_review: "📊",
  punctuality: "🕐",
  general: "🎓",
};

export default function StaffTraining() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    api.getTrainingRecommendations()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (idx, action) => {
    setChecked((prev) => ({ ...prev, [`${idx}-${action}`]: !prev[`${idx}-${action}`] }));
  };

  if (loading) return <div className="text-gray-400 text-sm p-8">Analysing staff data...</div>;
  if (!data) return null;

  const recs = data.recommendations;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🎓 AI Staff Training</h1>
        <p className="text-gray-400 mt-1">Data-driven recommendations based on waste, kitchen times & ratings</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-2xl">📋</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">Recommendations</p>
        </div>
        <div className="card">
          <p className="text-2xl">🚨</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{data.high_priority}</p>
          <p className="text-xs text-gray-400 mt-0.5">High Priority</p>
        </div>
        <div className="card">
          <p className="text-2xl">📈</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.total - data.high_priority}</p>
          <p className="text-xs text-gray-400 mt-0.5">Medium / Low Priority</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-5">
        {recs.map((rec, idx) => {
          const style = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low;
          const typeIcon = TYPE_ICONS[rec.type] || "🎓";
          return (
            <div key={idx} className={`bg-white rounded-2xl border-2 ${style.border} shadow-sm p-6`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{typeIcon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{rec.title}</h3>
                    <span className="text-xs text-gray-500 capitalize">{rec.type.replace("_", " ")}</span>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                  {style.icon} {rec.priority} priority
                </span>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mb-4">{rec.detail}</p>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Action Plan</p>
                <div className="space-y-2">
                  {rec.actions.map((action, ai) => (
                    <label key={ai} className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!checked[`${idx}-${ai}`]}
                        onChange={() => toggle(idx, ai)}
                        className="mt-0.5 accent-brand-500"
                      />
                      <span className={`text-sm transition-all ${checked[`${idx}-${ai}`] ? "line-through text-gray-300" : "text-gray-700 group-hover:text-gray-900"}`}>
                        {action}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        * Recommendations generated from food waste logs, kitchen time records, and staff performance ratings. Add more data to improve accuracy.
      </p>
    </div>
  );
}
