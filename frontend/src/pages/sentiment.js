import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

function SentimentBadge({ label }) {
  if (label === "positive") return <span className="badge-positive">Positive</span>;
  if (label === "negative") return <span className="badge-negative">Negative</span>;
  return <span className="badge-neutral">Neutral</span>;
}

function ScoreBar({ score }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score > 0.05 ? "bg-green-500" : score < -0.05 ? "bg-red-500" : "bg-gray-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{score.toFixed(2)}</span>
    </div>
  );
}

export default function SentimentPage() {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: "", menu_item: "", rating: 5, comment: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const fetchData = () =>
    Promise.all([api.getMenuItems(), api.getReviews(), api.getSentimentSummary()])
      .then(([items, r, s]) => { setMenuItems(items); setReviews(r); setSummary(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { fetchData(); }, []);

  const filtered = reviews.filter((r) =>
    (filter === "all" || r.sentiment_label === filter) &&
    (search === "" ||
      r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      r.menu_item.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.menu_item) { setFormError("Please select a menu item."); return; }
    const rating = parseInt(form.rating);
    if (rating < 1 || rating > 5) { setFormError("Rating must be between 1 and 5."); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.createReview({ ...form, rating });
      setShowForm(false);
      setForm({ customer_name: "", menu_item: "", rating: 5, comment: "" });
      fetchData();
    } catch (err) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (review) => {
    if (!window.confirm(`Delete review by "${review.customer_name}"?`)) return;
    setDeletingId(review.id);
    setDeleteError(null);
    try {
      await api.deleteReview(review.id);
      fetchData();
    } catch (err) {
      setDeleteError(err.message || "Failed to delete review.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFieldChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (formError) setFormError(null);
  };

  if (loading) return <LoadingSpinner message="Loading reviews..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const barData = summary
    ? [
        { label: "Positive", count: summary.positive_count, fill: "#22c55e" },
        { label: "Neutral", count: summary.neutral_count, fill: "#94a3b8" },
        { label: "Negative", count: summary.negative_count, fill: "#ef4444" },
      ]
    : [];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Sentiment</h1>
          <p className="text-gray-400 mt-1">Review analysis and sentiment scoring</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setFormError(null); }} className="btn-primary">
          {showForm ? "Cancel" : "+ Add Review"}
        </button>
      </div>

      {/* Add Review Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">Submit a Review</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input required value={form.customer_name} onChange={(e) => handleFieldChange("customer_name", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Menu Item</label>
              <select required value={form.menu_item} onChange={(e) => handleFieldChange("menu_item", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">Select item...</option>
                {menuItems.map((i) => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1–5)</label>
              <input type="number" min="1" max="5" required value={form.rating}
                onChange={(e) => handleFieldChange("rating", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea required value={form.comment} onChange={(e) => handleFieldChange("comment", e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            {formError && (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="col-span-2 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Analyzing..." : "Submit Review"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary + Chart */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <h2 className="text-base font-semibold mb-4">Overview</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-gray-500">Total Reviews</span><span className="font-semibold">{summary.total_reviews}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Avg Rating</span><span className="font-semibold">⭐ {summary.avg_rating.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Avg Sentiment</span><span className="font-semibold">{summary.avg_sentiment.toFixed(2)}</span></div>
              <hr className="border-gray-100" />
              <div className="flex justify-between"><span className="text-sm text-green-600">Positive</span><span className="font-semibold text-green-600">{summary.positive_count}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Neutral</span><span className="font-semibold">{summary.neutral_count}</span></div>
              <div className="flex justify-between"><span className="text-sm text-red-500">Negative</span><span className="font-semibold text-red-500">{summary.negative_count}</span></div>
            </div>
          </div>
          <div className="card lg:col-span-2">
            <h2 className="text-base font-semibold mb-4">Sentiment Distribution</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Reviews" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600 flex items-center justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-52"
        />
        {["all", "positive", "neutral", "negative"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {filtered.map((review) => (
          <div key={review.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{review.customer_name}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-500">{review.menu_item}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm">{"⭐".repeat(review.rating)}</span>
                </div>
                <p className="text-gray-700 mt-2 text-sm">{review.comment}</p>
                <div className="flex items-center gap-3 mt-2">
                  <ScoreBar score={review.sentiment_score} />
                  <SentimentBadge label={review.sentiment_label} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => handleDelete(review)}
                  disabled={deletingId === review.id}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete review"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10">No reviews match your search.</p>
        )}
      </div>
    </div>
  );
}
