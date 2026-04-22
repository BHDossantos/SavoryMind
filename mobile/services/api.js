import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://api.savorymind.net';
const TOKEN_KEY = 'sm_auth_token';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (t) => SecureStore.setItemAsync(TOKEN_KEY, t),
  remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

async function request(path, options = {}) {
  const token = await tokenStore.get();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: async (data) => {
    const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
    if (result?.access_token) await tokenStore.set(result.access_token);
    return result;
  },
  logout: () => tokenStore.remove(),
  getMe: () => request('/api/auth/me'),

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

  getTrainingRecommendations: () => request('/api/owner/training'),

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

  // Diner
  getDinerSummary: () => request('/api/diner/summary'),
  getDinerBookings: () => request('/api/diner/bookings'),
  createDinerBooking: (data) => request('/api/diner/bookings', { method: 'POST', body: JSON.stringify(data) }),
  cancelDinerBooking: (id) => request(`/api/diner/bookings/${id}/cancel`, { method: 'PATCH' }),
  getDinerVisits: () => request('/api/diner/visits'),
  createDinerVisit: (data) => request('/api/diner/visits', { method: 'POST', body: JSON.stringify(data) }),
  deleteDinerVisit: (id) => request(`/api/diner/visits/${id}`, { method: 'DELETE' }),
};
