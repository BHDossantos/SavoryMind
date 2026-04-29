export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

const TOKEN_KEY = "availablenow.token";
const USER_KEY = "availablenow.user";

export type Role = "customer" | "provider" | "admin";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

export interface Provider {
  id: number;
  user_id: number;
  display_name: string;
  bio: string;
  profile_photo_url: string;
  category: string;
  address: string;
  city: string;
  neighborhood: string;
  languages: string;
  is_verified: boolean;
  average_rating: number;
  review_count: number;
}

export interface ProviderSearchResult extends Provider {
  next_slot: string | null;
  min_price_cents: number | null;
}

export interface Service {
  id: number;
  provider_id: number;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  active: boolean;
  deposit_required: boolean;
  deposit_amount_cents: number;
}

export type PaymentStatus = "not_required" | "pending" | "paid" | "refunded" | "failed";

export interface Slot {
  start_at: string;
  end_at: string;
}

export interface Appointment {
  id: number;
  customer_id: number;
  provider_id: number;
  service_id: number;
  start_at: string;
  end_at: string;
  status: string;
  total_price_cents: number;
  deposit_amount_cents: number;
  payment_status: PaymentStatus;
  customer_notes: string;
  provider_display_name: string | null;
  service_name: string | null;
  has_review: boolean;
  can_review: boolean;
}

export interface BookingResult {
  appointment: Appointment;
  checkout_url: string | null;
  payment_id: number | null;
}

export interface Review {
  id: number;
  appointment_id: number;
  customer_id: number;
  provider_id: number;
  rating: number;
  comment: string;
  created_at: string;
  customer_first_name: string | null;
  service_name: string | null;
}

export interface AvailabilityWindow {
  id?: number;
  provider_id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function storeAuth(accessToken: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || text;
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  signup: (body: { email: string; password: string; first_name: string; last_name?: string; role: Role }) =>
    request<{ access_token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  searchProviders: (params: {
    category?: string;
    city?: string;
    available_now?: boolean;
    max_price_cents?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && v !== false) qs.set(k, String(v));
    });
    return request<ProviderSearchResult[]>(`/search/providers?${qs.toString()}`);
  },
  getProvider: (id: number) => request<Provider>(`/providers/${id}`),
  getProviderServices: (id: number) => request<Service[]>(`/providers/${id}/services`),
  getProviderSlots: (providerId: number, serviceId: number, days = 7) =>
    request<Slot[]>(`/providers/${providerId}/slots?service_id=${serviceId}&days=${days}`),
  book: (body: { service_id: number; start_at: string; customer_notes?: string }) =>
    request<BookingResult>("/appointments", { method: "POST", body: JSON.stringify(body) }),
  stubConfirmPayment: (paymentId: number) =>
    request<{ status: string }>(`/payments/stub-confirm/${paymentId}`, { method: "POST" }),
  myAppointments: () => request<Appointment[]>("/appointments/mine"),
  providerAppointments: () => request<Appointment[]>("/appointments/provider"),
  cancelAppointment: (id: number) =>
    request<Appointment>(`/appointments/${id}/cancel`, { method: "POST" }),
  createReview: (body: { appointment_id: number; rating: number; comment?: string }) =>
    request<Review>("/reviews", { method: "POST", body: JSON.stringify(body) }),
  getProviderReviews: (id: number) => request<Review[]>(`/providers/${id}/reviews`),

  // provider-side
  getMyProvider: () => request<Provider>("/providers/me"),
  upsertMyProvider: (body: Partial<Provider>) =>
    request<Provider>("/providers/me", { method: "POST", body: JSON.stringify(body) }),
  myServices: () => request<Service[]>("/services/mine"),
  createService: (body: Omit<Service, "id" | "provider_id">) =>
    request<Service>("/services", { method: "POST", body: JSON.stringify(body) }),
  updateService: (id: number, body: Omit<Service, "id" | "provider_id">) =>
    request<Service>(`/services/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteService: (id: number) => request<void>(`/services/${id}`, { method: "DELETE" }),
  myAvailability: () => request<AvailabilityWindow[]>("/availability/mine"),
  replaceMyAvailability: (rows: AvailabilityWindow[]) =>
    request<AvailabilityWindow[]>("/availability/mine", {
      method: "PUT",
      body: JSON.stringify(rows),
    }),
};

export function formatPrice(cents: number | null | undefined, currency = "EUR"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(cents / 100);
}

export function formatSlot(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
