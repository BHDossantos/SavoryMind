// All API calls go through the Next.js /backend rewrite → FastAPI server.
// BACKEND_URL is a server-side env var in next.config.js rewrites (never exposed to browser).
const BASE_URL = "/backend";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Only treat 401 as "session expired" for protected endpoints, not auth endpoints
  const isAuthEndpoint = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register") || path.startsWith("/api/auth/social");
  if ((res.status === 401 || res.status === 403) && !isAuthEndpoint) {
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
      const text = await res.text();
      if (text) {
        try { errMsg = JSON.parse(text).detail || errMsg; } catch { errMsg = text || errMsg; }
      }
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => request("/api/auth/me"),
  updateProfile: (data) => request("/api/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),

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

  // Consumer — Beverages (beer & spirits)
  getBeerPairing: (dish) => request(`/api/consumer/beverages/beer?dish=${encodeURIComponent(dish)}`),
  getSpiritsPairing: (dish) => request(`/api/consumer/beverages/spirits?dish=${encodeURIComponent(dish)}`),

  // Consumer — Recipes
  getRecipes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/consumer/recipes${qs ? `?${qs}` : ""}`);
  },
  getRecipe: (id) => request(`/api/consumer/recipes/${id}`),

  // Restaurant Owner — Food Waste
  getWasteLogs: () => request("/api/owner/waste"),
  getWasteSummary: () => request("/api/owner/waste/summary"),
  createWasteLog: (data) => request("/api/owner/waste", { method: "POST", body: JSON.stringify(data) }),
  deleteWasteLog: (id) => request(`/api/owner/waste/${id}`, { method: "DELETE" }),

  // Restaurant Owner — Kitchen Times
  getDishTimes: () => request("/api/owner/kitchen"),
  getKitchenSummary: () => request("/api/owner/kitchen/summary"),
  createDishTime: (data) => request("/api/owner/kitchen", { method: "POST", body: JSON.stringify(data) }),
  deleteDishTime: (id) => request(`/api/owner/kitchen/${id}`, { method: "DELETE" }),

  // Restaurant Owner — Training
  getTrainingRecommendations: () => request("/api/owner/training"),

  // Diner — Bookings
  getDinerBookings: () => request("/api/diner/bookings"),
  createDinerBooking: (data) => request("/api/diner/bookings", { method: "POST", body: JSON.stringify(data) }),
  cancelDinerBooking: (id) => request(`/api/diner/bookings/${id}/cancel`, { method: "PATCH" }),

  // Diner — Visits
  getDinerVisits: () => request("/api/diner/visits"),
  createDinerVisit: (data) => request("/api/diner/visits", { method: "POST", body: JSON.stringify(data) }),
  deleteDinerVisit: (id) => request(`/api/diner/visits/${id}`, { method: "DELETE" }),

  // Diner — Summary
  getDinerSummary: () => request("/api/diner/summary"),

  // Diner — Recommendations (ML engine)
  getDinerRecommendations: () => request("/api/diner/recommendations"),

  // Diner — Discovery
  discoverRestaurants: (params = {}) => request(`/api/diner/discover?${new URLSearchParams(params).toString()}`),
  getExperiencePlan: (params = {}) => request(`/api/diner/experience-plan?${new URLSearchParams(params).toString()}`),

  // Consumer — Meal Planner
  getMealPlan: (dietary = "", maxCook = 120) => request(`/api/consumer/meal-plan?dietary=${dietary}&max_cook_minutes=${maxCook}`),
  getShoppingList: (dietary = "") => request(`/api/consumer/shopping-list?dietary=${dietary}`),
  getDailySuggestion: (mood = "") => request(`/api/consumer/daily-suggestion?mood=${mood}`),

  // Restaurant — Trends & Marketing
  getMenuTrends: () => request("/api/restaurant/trends"),
  getMarketingInsights: () => request("/api/restaurant/marketing"),
};
