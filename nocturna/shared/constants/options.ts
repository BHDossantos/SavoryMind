// All vibe / music / group / budget / style options used by web + mobile.
// Single source of truth — keep in sync with backend recommender.

export const INTENTS = [
  { value: 'dinner', label: 'Dinner' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'dancing', label: 'Dancing' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'vip_table', label: 'VIP Table' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'aperitivo', label: 'Aperitivo' },
  { value: 'meet_people', label: 'Meet People' },
  { value: 'luxury', label: 'Luxury Night' },
  { value: 'budget', label: 'Budget Night' },
  { value: 'surprise', label: 'Surprise Me' },
  { value: 'dinner_drinks', label: 'Dinner + Drinks' },
] as const;

export const VIBES = [
  'romantic','elegant','wild','chill','luxury','latin','house_music','hip_hop','jazz',
  'rooftop_view','hidden_gem','tourist_friendly','local_authentic','singles_friendly',
  'date_friendly','after_work','late_night','techno','trendy','speakeasy','live_music'
] as const;

export const MUSIC = [
  'house','techno','electronic','hip_hop','rnb','latin','reggaeton','salsa','bachata',
  'kizomba','jazz','swing','funk','soul','rock','pop','indie','commercial','lounge','blues','synthwave'
] as const;

export const GROUP_TYPES = [
  'solo','date','friends','mixed','bachelor','bachelorette','business','celebration','birthday'
] as const;

export const BUDGET_BANDS = [
  { value: '25-50',     label: '€25–€50',  perPerson: 38 },
  { value: '50-100',    label: '€50–€100', perPerson: 75 },
  { value: '100-200',   label: '€100–€200',perPerson: 150 },
  { value: '200+',      label: '€200+',    perPerson: 280 },
  { value: 'vip-500+',  label: 'VIP €500+',perPerson: 700 },
  { value: 'vip-1000+', label: 'VIP €1000+',perPerson: 1400 },
  { value: 'vip-2000+', label: 'VIP €2000+',perPerson: 2800 },
] as const;

export const STYLES = [
  'streetwear','casual','business','elegant','sexy','luxury'
] as const;

export const TIME_OPTIONS = [
  { value: 'now',      label: 'Now' },
  { value: 'tonight',  label: 'Tonight' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend',  label: 'This weekend' },
  { value: 'specific', label: 'Specific date/time' },
] as const;

export const REQUEST_TYPES = [
  { value: 'dinner',     label: 'Dinner reservation' },
  { value: 'bar_table',  label: 'Bar table' },
  { value: 'guestlist',  label: 'Guest list' },
  { value: 'vip_table',  label: 'VIP table' },
  { value: 'special',    label: 'Special event' },
] as const;

export const CITIES = [
  { slug: 'rome',      label: 'Rome' },
  { slug: 'milan',     label: 'Milan' },
  { slug: 'barcelona', label: 'Barcelona' },
  { slug: 'paris',     label: 'Paris' },
  { slug: 'lisbon',    label: 'Lisbon' },
  { slug: 'miami',     label: 'Miami' },
  { slug: 'new_york',  label: 'New York' },
  { slug: 'dubai',     label: 'Dubai' },
  { slug: 'mykonos',   label: 'Mykonos' },
  { slug: 'ibiza',     label: 'Ibiza' },
] as const;

export type Vibe = typeof VIBES[number];
export type Intent = typeof INTENTS[number]['value'];
export type GroupType = typeof GROUP_TYPES[number];
