import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.savorymind.net';

// SecureStore keys. The native equivalents of:
//   web: in-memory access token + httpOnly refresh cookie
// On mobile we have neither — RN's fetch has no cookie jar — so both
// tokens go through SecureStore, which is OS-keychain-backed (Keychain
// on iOS, EncryptedSharedPreferences on Android). That's safer than
// AsyncStorage and roughly equivalent to httpOnly cookies for this
// threat model.
const ACCESS_KEY = 'sm_auth_token';
const REFRESH_KEY = 'sm_refresh_token';

export const tokenStore = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  setAccess: (t) => SecureStore.setItemAsync(ACCESS_KEY, t),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  setRefresh: (t) => SecureStore.setItemAsync(REFRESH_KEY, t),
  clear: () => Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]),
  // Legacy alias kept so any pre-refactor callers don't crash mid-flight.
  // Same effect as `clear()`.
  remove: () => Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]),
};

let _onUnauthenticated = null;
export function setUnauthenticatedHandler(fn) {
  _onUnauthenticated = fn;
}

// Coalesce parallel 401-driven refresh attempts onto a single in-flight
// promise so a screen that fires three queries doesn't fan out to three
// /refresh calls. Also makes recovery deterministic — every caller awaits
// the same outcome.
let _refreshInFlight = null;

async function _doRefresh() {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'mobile',
        'X-Refresh-Token': refresh,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) await tokenStore.setAccess(data.access_token);
    if (data.refresh_token) await tokenStore.setRefresh(data.refresh_token);
    return data;
  } catch {
    return null;
  }
}

async function tryRefresh() {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = _doRefresh().finally(() => { _refreshInFlight = null; });
  return _refreshInFlight;
}

async function request(path, options = {}, _didRefresh = false) {
  const token = await tokenStore.getAccess();
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // 30-min access tokens expire mid-session — transparently refresh once.
  // Auth endpoints excluded so a real "wrong password" doesn't get masked
  // as a refresh-then-retry loop.
  // Don't auto-refresh on auth endpoints — a 401 there means "wrong
  // password" (login) or "invalid id_token" (google) or "verifier
  // refused you" (social), not "your access token expired". Calling
  // /refresh in those cases would mask the real error and leave the
  // user staring at a misleading "Session expired" message.
  const isAuthEndpoint =
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/register') ||
    path.startsWith('/api/auth/refresh') ||
    path.startsWith('/api/auth/logout') ||
    path.startsWith('/api/auth/google') ||
    path.startsWith('/api/auth/social');

  if (res.status === 401 && !isAuthEndpoint && !_didRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, options, true);
    }
    // Refresh failed → really logged out. Wipe local creds and let the app
    // route the user back to /login via the registered handler.
    await tokenStore.clear();
    if (_onUnauthenticated) _onUnauthenticated();
    throw new Error('Session expired. Please log in again.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

async function _saveTokensFrom(result) {
  if (result?.access_token) await tokenStore.setAccess(result.access_token);
  if (result?.refresh_token) await tokenStore.setRefresh(result.refresh_token);
}

export const api = {
  // Auth
  register: async (data) => {
    const result = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
    await _saveTokensFrom(result);
    return result;
  },
  login: async (data) => {
    const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
    await _saveTokensFrom(result);
    return result;
  },
  // Native Google sign-in. Caller hands over the id_token from
  // expo-auth-session's Google provider response.authentication.idToken
  // (NOT the accessToken — that's a regular OAuth token without the
  // signed claims our backend needs to verify the user's identity).
  // Backend cryptographically validates the token via Google's JWKS
  // and mints a SavoryMind session — no shared secret on the device.
  googleLogin: async (idToken) => {
    const result = await request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
    await _saveTokensFrom(result);
    return result;
  },
  // Native Sign in with Apple (iOS only). Caller hands over the
  // identityToken from expo-apple-authentication's signInAsync result,
  // plus name + email from the same result on FIRST sign-in only — Apple
  // omits these from the token itself by design (see backend
  // services/apple_oauth.py for the full quirk explanation).
  appleLogin: async ({ idToken, name, email }) => {
    const result = await request('/api/auth/apple', {
      method: 'POST',
      body: JSON.stringify({
        id_token: idToken,
        name:     name || null,
        email:    email || null,
      }),
    });
    await _saveTokensFrom(result);
    return result;
  },
  // Server-side revoke (jti blacklist) plus local clear. If the network
  // call fails we still wipe local creds so the user isn't stuck logged
  // in client-side.
  logout: async () => {
    const refresh = await tokenStore.getRefresh();
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'X-Client-Type': 'mobile',
          ...(refresh ? { 'X-Refresh-Token': refresh } : {}),
        },
      });
    } catch {}
    await tokenStore.clear();
  },
  refresh: tryRefresh,
  getMe: () => request('/api/auth/me'),

  // Auth-level profile patch (display_name, language, etc.). Distinct
  // from updateProfile() further down — that one is the consumer-feature
  // endpoint. PATCH /api/auth/profile is the auth-managed surface used
  // for cross-feature preferences (language, account_type set-once, ...)
  updateAuthProfile: (data) => request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  // Menu
  getDashboardStats: () => request('/api/menu/stats'),
  getMenuItems: (category) => request(`/api/menu${category && category !== 'All' ? `?category=${category}` : ''}`),
  createMenuItem: (data) => request('/api/menu', { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id, data) => request(`/api/menu/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMenuItem: (id) => request(`/api/menu/${id}`, { method: 'DELETE' }),
  getRecommendations: () => request('/api/menu/recommendations/all'),

  // Reviews
  getReviews: () => request('/api/reviews'),
  getSentimentSummary: () => request('/api/reviews/summary'),
  createReview: (data) => request('/api/reviews', { method: 'POST', body: JSON.stringify(data) }),
  deleteReview: (id) => request(`/api/reviews/${id}`, { method: 'DELETE' }),

  // Reports
  getReportsSummary: () => request('/api/reports/summary'),

  // Restaurant extras
  getBookings: (date) => request(`/api/restaurant/bookings${date ? `?filter_date=${date}` : ''}`),
  getTodaySummary: () => request('/api/restaurant/bookings/today'),
  createBooking: (data) => request('/api/restaurant/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id, data) => request(`/api/restaurant/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBooking: (id) => request(`/api/restaurant/bookings/${id}`, { method: 'DELETE' }),

  getCRMSummary: () => request('/api/restaurant/crm/summary'),
  getCustomers: (search) => request(`/api/restaurant/crm${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data) => request('/api/restaurant/crm', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/api/restaurant/crm/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/api/restaurant/crm/${id}`, { method: 'DELETE' }),
  recordVisit: (id, spend) => request(`/api/restaurant/crm/${id}/visit?spend=${spend}`, { method: 'POST' }),

  getStaff: () => request('/api/restaurant/staff'),
  getStaffSummary: () => request('/api/restaurant/staff/summary'),
  createStaff: (data) => request('/api/restaurant/staff', { method: 'POST', body: JSON.stringify(data) }),
  deleteStaff: (id) => request(`/api/restaurant/staff/${id}`, { method: 'DELETE' }),

  getPredictions: () => request('/api/restaurant/predictions'),

  getWasteLogs: () => request('/api/owner/waste'),
  getWasteSummary: () => request('/api/owner/waste/summary'),
  createWasteLog: (data) => request('/api/owner/waste', { method: 'POST', body: JSON.stringify(data) }),
  deleteWasteLog: (id) => request(`/api/owner/waste/${id}`, { method: 'DELETE' }),

  getDishTimes: () => request('/api/owner/kitchen'),
  createDishTime: (data) => request('/api/owner/kitchen', { method: 'POST', body: JSON.stringify(data) }),
  deleteDishTime: (id) => request(`/api/owner/kitchen/${id}`, { method: 'DELETE' }),

  getStaffTimeLogs: () => request('/api/owner/staff-time'),
  getStaffTimeSummary: () => request('/api/owner/staff-time/summary'),
  createStaffTimeLog: (data) => request('/api/owner/staff-time', { method: 'POST', body: JSON.stringify(data) }),
  deleteStaffTimeLog: (id) => request(`/api/owner/staff-time/${id}`, { method: 'DELETE' }),

  getTrainingRecommendations: () => request('/api/owner/training'),

  // Staff portal — employee self-service
  getClockStatus: () => request('/api/staff/status'),
  clockIn: (data) => request('/api/staff/clock-in', { method: 'POST', body: JSON.stringify(data) }),
  clockOut: (data) => request('/api/staff/clock-out', { method: 'POST', body: JSON.stringify(data) }),
  getMyLogs: () => request('/api/staff/my-logs'),

  // Restaurant — employee management
  getEmployees: () => request('/api/staff/employees'),
  createEmployee: (data) => request('/api/staff/employees', { method: 'POST', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/api/staff/employees/${id}`, { method: 'DELETE' }),

  // Employee QR survey — public (no auth) + owner-side
  getEmployeeSurvey: (token) => request(`/api/employee-survey/${encodeURIComponent(token)}`),
  submitEmployeeSurvey: (token, body) => request(
    `/api/employee-survey/${encodeURIComponent(token)}/submit`,
    { method: 'POST', body: JSON.stringify(body) },
  ),
  getEmployeeQRCodes: () => request('/api/employee-survey/owner/employees'),
  getEmployeeSurveyResults: (id) => request(`/api/employee-survey/owner/employees/${id}/results`),

  // Consumer
  getWinePairings: () => request('/api/consumer/wine-pairing'),
  createWinePairing: (data) => request('/api/consumer/wine-pairing', { method: 'POST', body: JSON.stringify(data) }),
  getBeerPairing: (dish) => request(`/api/consumer/beverages/beer?dish=${encodeURIComponent(dish)}`),
  getSpiritsPairing: (dish) => request(`/api/consumer/beverages/spirits?dish=${encodeURIComponent(dish)}`),
  getMusicMoods: () => request('/api/consumer/music-mood'),
  createMusicMood: (data) => request('/api/consumer/music-mood', { method: 'POST', body: JSON.stringify(data) }),
  getRecipes: (params) => request(`/api/consumer/recipes?${new URLSearchParams(params).toString()}`),
  getRecipe: (id) => request(`/api/consumer/recipes/${id}`),
  getConnections: () => request('/api/consumer/connections'),
  updateConnection: (platform, data) => request(`/api/consumer/connections/${platform}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateProfile: (data) => request('/api/consumer/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  getConsumerRecommendations: () => request('/api/consumer/recommendations'),

  // Consumer — meal planner
  getMealPlan: (dietary = '', maxCook = 120) => request(`/api/consumer/meal-plan?dietary=${dietary}&max_cook_minutes=${maxCook}`),
  getShoppingList: (dietary = '') => request(`/api/consumer/shopping-list?dietary=${dietary}`),
  getDailySuggestion: (mood = '') => request(`/api/consumer/daily-suggestion?mood=${mood}`),

  // OAuth — Spotify (real Authorization Code flow). Same backend endpoints
  // the web client uses (see /api/oauth/spotify/* routes); only difference
  // is mobile opens authorize_url in WebBrowser instead of redirecting the
  // tab. After OAuth completes the backend redirects to FRONTEND_URL/
  // consumer/social?spotify=connected — the user closes the browser, mobile
  // refetches connections on focus, and the connection card flips to
  // "Connected as <Spotify display name>".
  startSpotifyAuth:    () => request('/api/oauth/spotify/start'),
  disconnectSpotify:   () => request('/api/oauth/spotify/disconnect', { method: 'POST' }),
  searchSpotify:       (query, limit = 12) => request('/api/oauth/spotify/search', { method: 'POST', body: JSON.stringify({ query, limit }) }),

  // Aggregated theme summary across a restaurant's reviews — top
  // complaints / praise / themes / tone breakdown derived from Claude's
  // per-review extraction. Empty top_* lists when ANTHROPIC_API_KEY isn't
  // set on the backend.
  getReviewThemes:     () => request('/api/reviews/themes'),

  // Consumer — Culinary Assistant (Claude Opus 4.7).
  // Backend route: POST /api/consumer/assistant {question} → {title, answer}.
  // Returns "Assistant not configured" if ANTHROPIC_API_KEY is unset on
  // the server, so the mobile UI can render that gracefully without crashing.
  // Phase 14 — conversation persistence. Pass the conversation_id from
  // a prior turn to continue that thread; omit it to start fresh.
  // The server owns the history now.
  askAssistant: (question, conversationId = null) => request('/api/consumer/assistant', {
    method: 'POST',
    body: JSON.stringify(conversationId ? { question, conversation_id: conversationId } : { question }),
  }),
  listConversations:  () => request('/api/consumer/assistant/conversations'),
  getConversation:    (id) => request(`/api/consumer/assistant/conversations/${id}`),
  deleteConversation: (id) => request(`/api/consumer/assistant/conversations/${id}`, { method: 'DELETE' }),

  // Phase 8 — catalog browse endpoints. Returned as { count, wines | beers | spirits }.
  getWineCatalog:    () => request('/api/consumer/catalog/wines'),
  getBeerCatalog:    () => request('/api/consumer/catalog/beers'),
  getSpiritsCatalog: () => request('/api/consumer/catalog/spirits'),

  // Diner
  getDinerSummary: () => request('/api/diner/summary'),
  getDinerBookings: () => request('/api/diner/bookings'),
  createDinerBooking: (data) => request('/api/diner/bookings', { method: 'POST', body: JSON.stringify(data) }),
  cancelDinerBooking: (id) => request(`/api/diner/bookings/${id}/cancel`, { method: 'PATCH' }),
  getDinerVisits: () => request('/api/diner/visits'),
  createDinerVisit: (data) => request('/api/diner/visits', { method: 'POST', body: JSON.stringify(data) }),
  deleteDinerVisit: (id) => request(`/api/diner/visits/${id}`, { method: 'DELETE' }),
  getDinerRecommendations: () => request('/api/diner/recommendations'),

  // Diner — discovery
  discoverRestaurants: (params) => request(`/api/diner/discover?${new URLSearchParams(params).toString()}`),
  getExperiencePlan: (params) => request(`/api/diner/experience-plan?${new URLSearchParams(params).toString()}`),

  // Restaurant — trends & marketing
  getMenuTrends: () => request('/api/restaurant/trends'),
  getMarketingInsights: () => request('/api/restaurant/marketing'),

  // (Removed) socialLogin — used to ship the SOCIAL_LOGIN_SECRET in client
  // env vars, which defeats the secret. Real OAuth on mobile would use
  // expo-auth-session (already installed) to redirect through the
  // provider, exchange the auth code via a short-lived bridge route on
  // the backend, and never expose the social secret to the device. Until
  // that's wired up, mobile uses email+password only.

  // ── Parity batch with web (commit "fix everything") ──────────────

  // Consumer profile (separate from /api/auth/profile — patches
  // consumer-specific fields)
  updateConsumerProfile: (data) => request('/api/consumer/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  // Consumer — Pantry inventory + on-hand recipe matching
  getPantry:        ()       => request('/api/consumer/pantry'),
  addPantryItem:    (data)   => request('/api/consumer/pantry', { method: 'POST', body: JSON.stringify(data) }),
  deletePantryItem: (id)     => request(`/api/consumer/pantry/${id}`, { method: 'DELETE' }),
  clearPantry:      ()       => request('/api/consumer/pantry', { method: 'DELETE' }),
  getPantryRecipes: ()       => request('/api/consumer/pantry/recipes'),

  // Consumer — Meal memories / journal
  getMemories:    ()      => request('/api/consumer/memories'),
  createMemory:   (data)  => request('/api/consumer/memories', { method: 'POST', body: JSON.stringify(data) }),
  deleteMemory:   (id)    => request(`/api/consumer/memories/${id}`, { method: 'DELETE' }),

  // Consumer — Delivery (note: backend currently returns hard-coded
  // suggestions; treat as a discovery feature, not real ordering)
  getDeliveryDishes:      (craving, budget = '') => request(`/api/consumer/delivery/dishes?craving=${craving}&budget=${budget}`),
  getDeliveryRestaurants: (cuisine)              => request(`/api/consumer/delivery/restaurants?cuisine=${encodeURIComponent(cuisine)}`),

  // Notifications — bell badge + dropdown UX
  getNotifications:        () => request('/api/notifications'),
  markNotificationsRead:   () => request('/api/notifications/read', { method: 'PATCH' }),

  // Restaurant — booking accept/decline
  confirmBooking: (id) => request(`/api/restaurant/bookings/${id}/confirm`, { method: 'PATCH' }),
  declineBooking: (id) => request(`/api/restaurant/bookings/${id}/decline`, { method: 'PATCH' }),

  // Restaurant — own availability (for online bookings via diner side)
  getMyAvailability:    () => request('/api/discover/my-availability'),
  updateMyAvailability: (data) => request('/api/discover/my-availability', { method: 'PATCH', body: JSON.stringify(data) }),

  // Restaurant — kitchen aggregate summary (different shape from getDishTimes)
  getKitchenSummary: () => request('/api/owner/kitchen/summary'),

  // Restaurant — staff edit (already has create/delete; web has updateStaff too)
  updateStaff: (id, data) => request(`/api/restaurant/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Diner — discovery + booking flow
  getRestaurant:    (id)        => request(`/api/discover/restaurants/${id}`),
  getAvailability:  (id, date)  => request(`/api/discover/availability/${id}?check_date=${date}`),
  requestBooking:   (data)      => request('/api/discover/book', { method: 'POST', body: JSON.stringify(data) }),

  // Diner — reviews
  createDinerReview: (data) => request('/api/diner/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getMyDinerReviews: ()     => request('/api/diner/reviews'),

  // Restaurant — diner reviews from customers
  getDinerReviews: () => request('/api/restaurant/diner-reviews'),

  // Restaurant — Inventory tracking
  getInventory: (category) =>
    request(`/api/inventory${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createInventoryItem: (data) =>
    request('/api/inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateInventoryItem: (id, patch) =>
    request(`/api/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  archiveInventoryItem: (id) =>
    request(`/api/inventory/${id}`, { method: 'DELETE' }),
  adjustInventoryItem: (id, data) =>
    request(`/api/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  categorizeInventoryItem: (name) =>
    request('/api/inventory/categorize', { method: 'POST', body: JSON.stringify({ name }) }),
};
