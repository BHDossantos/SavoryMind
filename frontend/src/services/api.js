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

  // Restaurant — Menu
  getDashboardStats: () => request("/api/menu/stats"),
  getMenuItems: (category) => request(`/api/menu/${category ? `?category=${category}` : ""}`),
  createMenuItem: (data) => request("/api/menu/", { method: "POST", body: JSON.stringify(data) }),
  updateMenuItem: (id, data) => request(`/api/menu/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMenuItem: (id) => request(`/api/menu/${id}`, { method: "DELETE" }),
  getRecommendations: () => request("/api/menu/recommendations/all"),

  // Restaurant — Reviews
  getReviews: () => request("/api/reviews/"),
  getSentimentSummary: () => request("/api/reviews/summary"),
  createReview: (data) => request("/api/reviews/", { method: "POST", body: JSON.stringify(data) }),
  deleteReview: (id) => request(`/api/reviews/${id}`, { method: "DELETE" }),

  // Restaurant — Reports
  getReportsSummary: () => request("/api/reports/summary"),

  // Restaurant — Bookings
  getTodaySummary: () => request("/api/restaurant/bookings/today"),
  getBookings: (date) => request(`/api/restaurant/bookings${date ? `?filter_date=${date}` : ""}`),
  createBooking: (data) => request("/api/restaurant/bookings", { method: "POST", body: JSON.stringify(data) }),
  updateBooking: (id, data) => request(`/api/restaurant/bookings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBooking: (id) => request(`/api/restaurant/bookings/${id}`, { method: "DELETE" }),

  // Restaurant — CRM
  getCRMSummary: () => request("/api/restaurant/crm/summary"),
  getCustomers: (search) => request(`/api/restaurant/crm${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (data) => request("/api/restaurant/crm", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/api/restaurant/crm/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/api/restaurant/crm/${id}`, { method: "DELETE" }),
  recordVisit: (id, spend) => request(`/api/restaurant/crm/${id}/visit?spend=${spend}`, { method: "POST" }),

  // Restaurant — Staff
  getStaffSummary: () => request("/api/restaurant/staff/summary"),
  getStaff: () => request("/api/restaurant/staff"),
  createStaff: (data) => request("/api/restaurant/staff", { method: "POST", body: JSON.stringify(data) }),
  updateStaff: (id, data) => request(`/api/restaurant/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStaff: (id) => request(`/api/restaurant/staff/${id}`, { method: "DELETE" }),

  // Restaurant — Predictions
  getPredictions: () => request("/api/restaurant/predictions"),

  // Consumer — Wine Pairing
  createWinePairing: (data) => request("/api/consumer/wine-pairing", { method: "POST", body: JSON.stringify(data) }),
  getWinePairings: () => request("/api/consumer/wine-pairing"),

  // Consumer — Music Mood
  createMusicMood: (data) => request("/api/consumer/music-mood", { method: "POST", body: JSON.stringify(data) }),
  getMusicMoods: () => request("/api/consumer/music-mood"),

  // Consumer — Social connections
  getConnections: () => request("/api/consumer/connections"),
  updateConnection: (platform, data) => request(`/api/consumer/connections/${platform}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Consumer — Profile
  updateProfile: (data) => request("/api/consumer/profile", { method: "PATCH", body: JSON.stringify(data) }),

  // Consumer — AI recommendations
  getConsumerRecommendations: () => request("/api/consumer/recommendations"),
};
