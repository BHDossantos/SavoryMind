// In production call the backend directly from the browser (no Next.js proxy needed).
// NEXT_PUBLIC_API_URL is set at build/deploy time (see deploy-frontend.yml).
// In local dev the proxy rewrite forwards /backend/* → localhost:8000.
const PROD_API = process.env.NEXT_PUBLIC_API_URL || "https://api.savorymind.net";

function getBaseUrl() {
  if (typeof window === "undefined") return "/backend"; // SSR fallback (unused for auth)
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? "/backend" : PROD_API;
}

// In-memory access token. Lives only for the lifetime of this JS context, so
// XSS cannot persist a stolen token across page reloads (unlike localStorage).
// AuthContext repopulates this on mount via /api/auth/refresh, which uses the
// httpOnly refresh cookie that JS cannot read.
let _accessToken = null;
let _onUnauthenticated = null;

export function setAccessToken(token) {
  _accessToken = token || null;
}

export function getAccessToken() {
  return _accessToken;
}

// AuthContext registers a callback for when refresh fails (cookie missing or
// rejected). Default = redirect to /login.
export function setUnauthenticatedHandler(fn) {
  _onUnauthenticated = fn;
}

let _refreshInFlight = null;

async function tryRefresh() {
  // Coalesce concurrent 401s — if 5 requests fail at once, only one /refresh
  // call is made and they all wait on the same promise.
  if (_refreshInFlight) return _refreshInFlight;

  const BASE_URL = getBaseUrl();
  _refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      _accessToken = data.access_token;
      return data;
    } catch {
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

async function request(path, options = {}, _attempt = 0, _didRefresh = false) {
  const BASE_URL = getBaseUrl();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      // Send the refresh cookie on every request so /auth/refresh works and
      // the browser keeps it across navigations. Required by the
      // allow_credentials=True backend CORS policy.
      credentials: "include",
    });
  } catch (networkErr) {
    // Auto-retry on network failure (Render cold-start wake-up), up to 3 times
    if (_attempt < 3) {
      await new Promise((r) => setTimeout(r, [3000, 6000, 12000][_attempt]));
      return request(path, options, _attempt + 1, _didRefresh);
    }
    throw new Error("Server is unreachable. It may still be starting up — please wait a moment and try again.");
  }

  // 401 = expired/invalid access token. Try to refresh once via the httpOnly
  // refresh cookie, then retry the original request. If refresh fails, the
  // user really is logged out.
  // Auth endpoints are excluded — refreshing on a failed login would mask the
  // real "wrong password" error.
  const isAuthEndpoint =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/social") ||
    path.startsWith("/api/auth/refresh") ||
    path.startsWith("/api/auth/logout");

  if (res.status === 401 && !isAuthEndpoint && !_didRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, options, _attempt, true);
    }
    // Refresh failed → user is logged out
    _accessToken = null;
    if (_onUnauthenticated) {
      _onUnauthenticated();
    } else if (typeof window !== "undefined") {
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
  refresh: () => request("/api/auth/refresh", { method: "POST" }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
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
  confirmBooking: (id) => request(`/api/restaurant/bookings/${id}/confirm`, { method: "PATCH" }),
  declineBooking: (id) => request(`/api/restaurant/bookings/${id}/decline`, { method: "PATCH" }),

  // Restaurant — Availability (for online bookings)
  getMyAvailability: () => request("/api/discover/my-availability"),
  updateMyAvailability: (data) => request("/api/discover/my-availability", { method: "PATCH", body: JSON.stringify(data) }),

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

  // Consumer — Profile (use updateAuthProfile for onboarding completion)
  updateConsumerProfile: (data) => request("/api/consumer/profile", { method: "PATCH", body: JSON.stringify(data) }),

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

  // Consumer — Pantry
  getPantry: () => request("/api/consumer/pantry"),
  addPantryItem: (data) => request("/api/consumer/pantry", { method: "POST", body: JSON.stringify(data) }),
  deletePantryItem: (id) => request(`/api/consumer/pantry/${id}`, { method: "DELETE" }),
  clearPantry: () => request("/api/consumer/pantry", { method: "DELETE" }),
  getPantryRecipes: () => request("/api/consumer/pantry/recipes"),

  // Consumer — Delivery
  getDeliveryDishes: (craving, budget = "") => request(`/api/consumer/delivery/dishes?craving=${craving}&budget=${budget}`),
  getDeliveryRestaurants: (cuisine) => request(`/api/consumer/delivery/restaurants?cuisine=${encodeURIComponent(cuisine)}`),

  // Consumer — Meal Memories (journal)
  getMemories: () => request("/api/consumer/memories"),
  createMemory: (data) => request("/api/consumer/memories", { method: "POST", body: JSON.stringify(data) }),
  deleteMemory: (id) => request(`/api/consumer/memories/${id}`, { method: "DELETE" }),

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

  // Diner — Discovery (real registered restaurants)
  discoverRestaurants: (params = {}) => request(`/api/discover/restaurants?${new URLSearchParams(params).toString()}`),
  getRestaurant: (id) => request(`/api/discover/restaurants/${id}`),
  getAvailability: (id, date) => request(`/api/discover/availability/${id}?check_date=${date}`),
  requestBooking: (data) => request("/api/discover/book", { method: "POST", body: JSON.stringify(data) }),
  getExperiencePlan: (params = {}) => request(`/api/diner/experience-plan?${new URLSearchParams(params).toString()}`),

  // Consumer — Meal Planner
  getMealPlan: (dietary = "", maxCook = 120) => request(`/api/consumer/meal-plan?dietary=${dietary}&max_cook_minutes=${maxCook}`),
  getShoppingList: (dietary = "") => request(`/api/consumer/shopping-list?dietary=${dietary}`),
  getDailySuggestion: (mood = "") => request(`/api/consumer/daily-suggestion?mood=${mood}`),

  // Consumer — Culinary Assistant
  askAssistant: (question) => request("/api/consumer/assistant", { method: "POST", body: JSON.stringify({ question }) }),

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

  // Notifications
  getNotifications: () => request("/api/notifications"),
  markNotificationsRead: () => request("/api/notifications/read", { method: "PATCH" }),

  // Diner — Reviews
  createDinerReview: (data) => request("/api/diner/reviews", { method: "POST", body: JSON.stringify(data) }),
  getMyDinerReviews: () => request("/api/diner/reviews"),

  // Restaurant — Diner reviews from customers
  getDinerReviews: () => request("/api/restaurant/diner-reviews"),
};
