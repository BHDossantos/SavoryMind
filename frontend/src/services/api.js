const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (res.status === 204) return null;

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.detail || errMsg;
    } catch {
      errMsg = (await res.text()) || errMsg;
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => request("/api/auth/me"),

  // Menu
  getDashboardStats: () => request("/api/menu/stats"),
  getMenuItems: (category) => request(`/api/menu/${category ? `?category=${category}` : ""}`),
  createMenuItem: (data) => request("/api/menu/", { method: "POST", body: JSON.stringify(data) }),
  updateMenuItem: (id, data) => request(`/api/menu/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMenuItem: (id) => request(`/api/menu/${id}`, { method: "DELETE" }),
  getRecommendations: () => request("/api/menu/recommendations/all"),

  // Reviews
  getReviews: () => request("/api/reviews/"),
  getSentimentSummary: () => request("/api/reviews/summary"),
  createReview: (data) => request("/api/reviews/", { method: "POST", body: JSON.stringify(data) }),
  deleteReview: (id) => request(`/api/reviews/${id}`, { method: "DELETE" }),

  // Reports
  getReportsSummary: () => request("/api/reports/summary"),
};
