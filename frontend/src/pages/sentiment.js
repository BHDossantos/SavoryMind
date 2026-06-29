import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import { api } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

function SentimentBadge({ label }) {
  const { t } = useTranslation();
  if (label === "positive") return <span className="badge-positive">{t("sentimentPage.badgePositive")}</span>;
  if (label === "negative") return <span className="badge-negative">{t("sentimentPage.badgeNegative")}</span>;
  return <span className="badge-neutral">{t("sentimentPage.badgeNeutral")}</span>;
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

// Per-review draft-response control. The operator generates a draft, edits
// it inline, then saves — nothing is ever auto-published. Saved responses
// stay visible so the page doubles as a reply history.
function ReviewResponseBlock({ review, onSaved }) {
  const { t } = useTranslation();
  const [draft, setDraft]     = useState(review.response || "");
  const [open, setOpen]       = useState(!!review.response);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState(null);

  const generate = async () => {
    setLoading(true); setErr(null);
    try {
      const d = await api.draftReviewResponse(review.id);
      setDraft(d.response || "");
      setOpen(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await api.saveReviewResponse(review.id, draft);
      onSaved?.();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (!open && !review.response) {
    return (
      <div className="mt-3">
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs font-bold bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? t("sentimentPage.draftLoading") : t("sentimentPage.draftCta")}
        </button>
        {err && <span className="text-xs text-red-600 ml-2">{err}</span>}
      </div>
    );
  }

  return (
    <div className="mt-3 border-l-4 border-brand-200 pl-3">
      <p className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1">
        {t("sentimentPage.responseHeading")}
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-60"
        >
          {saving ? t("sentimentPage.saving") : t("sentimentPage.saveResponse")}
        </button>
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs font-medium text-brand-600 hover:text-brand-800"
        >
          {loading ? "…" : t("sentimentPage.regenerate")}
        </button>
        {review.responded_at && (
          <span className="text-[11px] text-gray-400 ml-auto">
            {t("sentimentPage.respondedAt", { date: new Date(review.responded_at).toLocaleDateString() })}
          </span>
        )}
      </div>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

export default function SentimentPage() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  // Claude-extracted top complaints / praise / themes / tone breakdown,
  // populated by the /api/reviews/themes endpoint. Empty top_* lists
  // when no reviews have been enriched yet (either ANTHROPIC_API_KEY
  // isn't set or every review predates the enrichment commit).
  const [themes, setThemes] = useState(null);
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
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [activeTab, setActiveTab] = useState("internal");
  const [dinerReviews, setDinerReviews] = useState([]);
  const [dinerReviewsLoading, setDinerReviewsLoading] = useState(false);

  const fetchData = () =>
    Promise.all([
      api.getMenuItems(),
      api.getReviews(),
      api.getSentimentSummary(),
      // Themes is opt-in based on Claude availability; never let it
      // block the page if the route isn't deployed yet or returns 4xx.
      api.getReviewThemes().catch(() => null),
    ])
      .then(([items, r, s, t]) => { setMenuItems(items); setReviews(r); setSummary(s); setThemes(t); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  const fetchDinerReviews = () => {
    setDinerReviewsLoading(true);
    api.getDinerReviews()
      .then((data) => setDinerReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setDinerReviewsLoading(false));
  };

  useEffect(() => { fetchData(); fetchDinerReviews(); }, []);

  const filtered = reviews.filter((r) =>
    (filter === "all" || r.sentiment_label === filter) &&
    (search === "" ||
      r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      r.menu_item.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.menu_item) { setFormError(t("sentimentPage.selectMenuItem")); return; }
    const rating = parseInt(form.rating);
    if (rating < 1 || rating > 5) { setFormError(t("sentimentPage.ratingBetween")); return; }
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

  const handleDelete = (review) => {
    setConfirmDialog({
      message: t("sentimentPage.deleteReviewPrompt", { name: review.customer_name }),
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeletingId(review.id);
        setDeleteError(null);
        try {
          await api.deleteReview(review.id);
          fetchData();
        } catch (err) {
          setDeleteError(err.message || t("sentimentPage.deleteFailed"));
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleFieldChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (formError) setFormError(null);
  };

  if (loading) return <LoadingSpinner message={t("sentimentPage.loading")} />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const barData = summary
    ? [
        { label: t("sentimentPage.positive"), count: summary.positive_count, fill: "#22c55e" },
        { label: t("sentimentPage.neutral"),  count: summary.neutral_count,  fill: "#94a3b8" },
        { label: t("sentimentPage.negative"), count: summary.negative_count, fill: "#ef4444" },
      ]
    : [];

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("sentimentPage.title")}</h1>
          <p className="text-gray-400 mt-1">{t("sentimentPage.subtitle")}</p>
        </div>
        {activeTab === "internal" && (
          <button onClick={() => { setShowForm(!showForm); setFormError(null); }} className="btn-primary">
            {showForm ? t("sentimentPage.cancel") : t("sentimentPage.addReview")}
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setActiveTab("internal")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "internal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          {t("sentimentPage.tabInternal")} {reviews.length > 0 && <span className="ml-1 text-xs text-gray-400">({reviews.length})</span>}
        </button>
        <button onClick={() => setActiveTab("platform")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "platform" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          {t("sentimentPage.tabPlatform")} {dinerReviews.length > 0 && <span className="ml-1 text-xs text-gray-400">({dinerReviews.length})</span>}
        </button>
      </div>

      {/* Platform reviews panel */}
      {activeTab === "platform" && (
        <div>
          {dinerReviewsLoading ? (
            <LoadingSpinner message={t("sentimentPage.loadingPlatform")} />
          ) : dinerReviews.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl">
              <p className="text-3xl mb-3">⭐</p>
              <p className="text-gray-600 font-semibold">{t("sentimentPage.noPlatform")}</p>
              <p className="text-sm text-gray-400 mt-1">{t("sentimentPage.noPlatformSub")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dinerReviews.map((r, i) => (
                <div key={i} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{r.diner_name || t("sentimentPage.anonymousDiner")}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-sm">{"⭐".repeat(Math.round(r.rating || 0))}</span>
                        <span className="text-xs text-gray-500">{r.rating?.toFixed(1)}</span>
                      </div>
                      {r.comment && <p className="text-gray-700 mt-2 text-sm">{r.comment}</p>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "internal" && <div>

      {/* Add Review Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">{t("sentimentPage.submitReviewTitle")}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("sentimentPage.customerName")}</label>
              <input required value={form.customer_name} onChange={(e) => handleFieldChange("customer_name", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("sentimentPage.menuItem")}</label>
              <select required value={form.menu_item} onChange={(e) => handleFieldChange("menu_item", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">{t("sentimentPage.selectItem")}</option>
                {menuItems.map((i) => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("sentimentPage.rating")}</label>
              <input type="number" min="1" max="5" required value={form.rating}
                onChange={(e) => handleFieldChange("rating", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("sentimentPage.comment")}</label>
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
                {saving ? t("sentimentPage.analyzing") : t("sentimentPage.submitReview")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary + Chart */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <h2 className="text-base font-semibold mb-4">{t("sentimentPage.overview")}</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-gray-500">{t("sentimentPage.totalReviews")}</span><span className="font-semibold">{summary.total_reviews}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">{t("sentimentPage.avgRating")}</span><span className="font-semibold">⭐ {summary.avg_rating.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">{t("sentimentPage.avgSentiment")}</span><span className="font-semibold">{summary.avg_sentiment.toFixed(2)}</span></div>
              <hr className="border-gray-100" />
              <div className="flex justify-between"><span className="text-sm text-green-600">{t("sentimentPage.positive")}</span><span className="font-semibold text-green-600">{summary.positive_count}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">{t("sentimentPage.neutral")}</span><span className="font-semibold">{summary.neutral_count}</span></div>
              <div className="flex justify-between"><span className="text-sm text-red-500">{t("sentimentPage.negative")}</span><span className="font-semibold text-red-500">{summary.negative_count}</span></div>
            </div>
          </div>
          <div className="card lg:col-span-2">
            <h2 className="text-base font-semibold mb-4">{t("sentimentPage.sentimentDistribution")}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name={t("sentimentPage.reviewsLegend")} radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* What guests are talking about — Claude-derived theme aggregation
          across reviews. Three states:
          - no reviews at all → hide entirely (sentiment chart already covers it)
          - reviews exist but none enriched → empty state pointing at the
            backfill / API key (covers Claude-less deploys + pre-PR-18 reviews)
          - enriched reviews exist → render the populated panel. */}
      {themes && themes.total_reviews > 0 && themes.enriched_reviews === 0 && (
        <div className="card mb-6" data-testid="themes-empty">
          <h2 className="text-base font-semibold mb-1">{t("sentimentPage.whatGuestsTalking")}</h2>
          <p className="text-sm text-gray-600">
            {t("sentimentPage.noneAnalysed", { total: themes.total_reviews })}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {t("sentimentPage.noneAnalysedHelp")}{" "}
            run <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">python -m scripts.backfill_themes</code>{" "}
            (requires <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">ANTHROPIC_API_KEY</code>).
          </p>
        </div>
      )}
      {themes && themes.enriched_reviews > 0 && (
        <div className="card mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold">{t("sentimentPage.whatGuestsTalking")}</h2>
            <span className="text-xs text-gray-500">
              {t("sentimentPage.fromOf", { enriched: themes.enriched_reviews, total: themes.total_reviews })}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {themes.top_complaints && themes.top_complaints.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">
                  {t("sentimentPage.topComplaints")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {themes.top_complaints.map((c) => (
                    <span key={c.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-red-400 font-semibold">×{c.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {themes.top_praise && themes.top_praise.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">
                  {t("sentimentPage.topPraise")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {themes.top_praise.map((p) => (
                    <span key={p.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs">
                      <span className="font-medium">{p.label}</span>
                      <span className="text-green-500 font-semibold">×{p.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {themes.top_themes && themes.top_themes.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">
                  {t("sentimentPage.themes")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {themes.top_themes.map((t) => (
                    <span key={t.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-blue-400 font-semibold">×{t.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {themes.tone_breakdown && Object.keys(themes.tone_breakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 text-xs">
              <span className="text-gray-500">{t("sentimentPage.tone")}</span>
              {Object.entries(themes.tone_breakdown).map(([tone, count]) => (
                <span key={tone} className="text-gray-700">
                  <span className="capitalize">{tone}</span>{" "}
                  <span className="text-gray-400 font-semibold">×{count}</span>
                </span>
              ))}
            </div>
          )}
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
          placeholder={t("sentimentPage.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-52"
        />
        {[
          ["all", "filterAll"],
          ["positive", "positive"],
          ["neutral", "neutral"],
          ["negative", "negative"],
        ].map(([f, k]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t(`sentimentPage.${k}`)}
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
                <ReviewResponseBlock review={review} onSaved={fetchData} />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => handleDelete(review)}
                  disabled={deletingId === review.id}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title={t("sentimentPage.deleteReview")}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10">{t("sentimentPage.noReviewsMatch")}</p>
        )}
      </div>

      </div>}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
