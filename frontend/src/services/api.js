// In production (any non-localhost host) call the Render backend directly from the browser —
// no Next.js proxy needed and no env var dependency.
// In local dev the proxy rewrite forwards /backend/* → localhost:8000.
const PROD_API = "https://savorymind-api.onrender.com";
function getBaseUrl() {
  if (typeof window === "undefined") return "/backend"; // SSR fallback (unused for auth)
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? "/backend" : PROD_API;
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request(path, options = {}, _attempt = 0) {
  const BASE_URL = getBaseUrl();
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (networkErr) {
    // Auto-retry on network failure (Render cold-start wake-up), up to 3 times
    if (_attempt < 3) {
      await new Promise((r) => setTimeout(r, ((_attempt + 1) * 8000)));
      return request(path, options, _attempt + 1);
    }
    throw new Error("Cannot reach the server. It may be starting up — please try again in a moment.");
  }

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

  // Restaurant Owner — Staff Time Tracking
  getStaffTimeLogs: () => request("/api/owner/staff-time"),
  getStaffTimeSummary: () => request("/api/owner/staff-time/summary"),
  createStaffTimeLog: (data) => request("/api/owner/staff-time", { method: "POST", body: JSON.stringify(data) }),
  deleteStaffTimeLog: (id) => request(`/api/owner/staff-time/${id}`, { method: "DELETE" }),

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

  // Restaurant — Employee account management
  getEmployees: () => request("/api/staff/employees"),
  createEmployee: (data) => request("/api/staff/employees", { method: "POST", body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/api/staff/employees/${id}`, { method: "DELETE" }),

  // Staff portal — self-service clock in/out
  getClockStatus: () => request("/api/staff/status"),
  clockIn: (data) => request("/api/staff/clock-in", { method: "POST", body: JSON.stringify(data) }),
  clockOut: (data) => request("/api/staff/clock-out", { method: "POST", body: JSON.stringify(data) }),
  getMyLogs: () => request("/api/staff/my-logs"),
};
