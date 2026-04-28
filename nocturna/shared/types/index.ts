export type DressCode = 'streetwear' | 'casual' | 'business' | 'elegant' | 'sexy' | 'luxury';
export type VenueType =
  | 'restaurant' | 'bar' | 'club' | 'lounge' | 'rooftop' | 'live_music' | 'speakeasy' | 'late_food';
export type BookingRequestType = 'dinner' | 'bar_table' | 'guestlist' | 'vip_table' | 'special';
export type BookingStatus = 'new' | 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'no_show';
export type PlanStatus = 'draft' | 'shared' | 'booked' | 'completed' | 'cancelled';

export interface Venue {
  id: number;
  slug: string;
  name: string;
  type: VenueType;
  description?: string | null;
  address: string;
  lat: number;
  lng: number;
  neighborhood: string;
  city: string;
  country: string;
  opening_hours: Record<string, { open: string; close: string }[]>;
  best_arrival_time?: string | null;
  price_level: number;
  avg_price_eur: number;
  dress_code: DressCode;
  music_types: string[];
  crowd_types: string[];
  vibe_tags: string[];
  cuisine_tags: string[];
  reservation_required: boolean;
  walk_in_ok: boolean;
  vip_available: boolean;
  guestlist_required: boolean;
  contact: { phone?: string; whatsapp?: string; email?: string; instagram?: string; website?: string };
  photos: string[];
  menu_url?: string | null;
  booking_url?: string | null;
  capacity?: number | null;
  partner_status: 'none' | 'basic' | 'pro' | 'premium';
  promoted: boolean;
  best_nights: string[];
  active: boolean;
}

export interface PlanStop {
  venue_id: number;
  slug: string;
  name: string;
  type: VenueType;
  neighborhood: string;
  slot_role: string;
  slot_start: string;
  slot_end: string;
  score: number;
  score_parts: Record<string, number>;
  promoted: boolean;
  summary: string;
  lat: number;
  lng: number;
  travel_to_next_min: number;
  venue?: Partial<Venue>;
}

export interface Plan {
  id: number;
  share_token: string | null;
  city: string;
  requested_for: string | null;
  group_size: number;
  group_type: string;
  budget_per_person: number;
  budget_band: string;
  vibe_tags: string[];
  music_pref: string[];
  cuisine_pref: string[];
  style: string;
  neighborhood_pref: string[];
  intent: string;
  label: string;
  estimated_cost_eur: number;
  total_travel_min: number;
  vibe_score: number;
  status: PlanStatus;
  stops: PlanStop[];
  rationale?: string;
  dress_code?: DressCode;
}

export interface PlannerRequest {
  city: string;
  requested_for?: string;
  intent: string;
  vibe_tags: string[];
  music_pref: string[];
  cuisine_pref?: string[];
  style: string;
  group_type: string;
  group_size: number;
  budget_band: string;
  budget_per_person: number;
  neighborhood_pref?: string[];
  user_lat?: number;
  user_lng?: number;
  accept_long_route?: boolean;
  plan_count?: number;
}

export interface Booking {
  id: number;
  status: BookingStatus;
  venue_id: number;
  venue?: { id: number; name: string; slug: string; address: string; neighborhood: string; contact: any; dress_code: string };
  plan_id?: number | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  date: string;
  time: string;
  group_size: number;
  request_type: BookingRequestType;
  budget_eur?: number | null;
  bottle_preference?: string | null;
  arrival_time?: string | null;
  notes?: string | null;
  vip_interest: 'yes' | 'no';
  venue_response?: string | null;
  created_at?: string;
}

export interface UserProfile {
  id: number;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: 'user' | 'admin';
  lang: string;
  home_city: string;
  prefs: Record<string, any>;
}

export interface City {
  slug: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  center: { lat: number; lng: number };
  neighborhoods: string[];
  nightlife_window: Record<string, [string, string]>;
}
