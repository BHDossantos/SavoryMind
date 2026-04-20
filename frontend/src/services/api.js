const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getDashboardStats: () => request("/api/menu/stats"),
  getMenuItems: () => request("/api/menu/"),
  createMenuItem: (data) => request("/api/menu/", { method: "POST", body: JSON.stringify(data) }),
  updateMenuItem: (id, data) => request(`/api/menu/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMenuItem: (id) => request(`/api/menu/${id}`, { method: "DELETE" }),
  getRecommendations: () => request("/api/menu/recommendations/all"),
  getReviews: () => request("/api/reviews/"),
  getSentimentSummary: () => request("/api/reviews/summary"),
  createReview: (data) => request("/api/reviews/", { method: "POST", body: JSON.stringify(data) }),
  deleteReview: (id) => request(`/api/reviews/${id}`, { method: "DELETE" }),
  getReportsSummary: () => request("/api/reports/summary"),
};
