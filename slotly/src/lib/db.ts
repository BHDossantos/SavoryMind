import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "slotly.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __slotlyDb: Database.Database | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  city TEXT DEFAULT 'Rome',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Rome',
  neighborhood TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  price_level INTEGER DEFAULT 2,
  tags TEXT,
  reliability_score INTEGER DEFAULT 70,
  partner_status TEXT DEFAULT 'none',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS booking_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  raw_request_text TEXT,
  city TEXT NOT NULL DEFAULT 'Rome',
  neighborhood TEXT,
  date_requested TEXT,
  time_requested TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  budget_min INTEGER,
  budget_max INTEGER,
  vibe TEXT,
  special_requests TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'submitted','in_review','searching','contacting','needs_approval',
      'confirmed','failed','cancelled','completed'
    )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','priority','vip')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_user ON booking_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS candidate_businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  match_score INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  contact_status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id),
  method TEXT NOT NULL,
  result TEXT,
  notes TEXT,
  contacted_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES booking_requests(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON notifications(next_attempt_at)
  WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS confirmed_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL UNIQUE REFERENCES booking_requests(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id),
  business_name TEXT,
  confirmed_date TEXT NOT NULL,
  confirmed_time TEXT NOT NULL,
  confirmation_name TEXT,
  confirmation_code TEXT,
  venue_contact_phone TEXT,
  address TEXT,
  instructions TEXT,
  cancellation_policy TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function init(database: Database.Database) {
  // Wait up to 5s for any other process holding a write lock — `next build`
  // spawns parallel page-data workers that all init the DB at once and would
  // otherwise SQLITE_BUSY out during initial WAL setup.
  database.pragma("busy_timeout = 5000");
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(SCHEMA);
}

export const db: Database.Database =
  global.__slotlyDb ??
  (() => {
    const d = new Database(DB_PATH);
    init(d);
    return d;
  })();

if (process.env.NODE_ENV !== "production") global.__slotlyDb = db;

export type Role = "user" | "admin";
export type RequestStatus =
  | "submitted"
  | "in_review"
  | "searching"
  | "contacting"
  | "needs_approval"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "completed";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  preferred_language: string;
  city: string;
  role: Role;
  created_at: string;
}

export interface BookingRequestRow {
  id: number;
  user_id: number;
  category: string;
  raw_request_text: string | null;
  city: string;
  neighborhood: string | null;
  date_requested: string | null;
  time_requested: string | null;
  party_size: number;
  budget_min: number | null;
  budget_max: number | null;
  vibe: string | null;
  special_requests: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: RequestStatus;
  priority: "normal" | "priority" | "vip";
  created_at: string;
  updated_at: string;
}

export interface BusinessRow {
  id: number;
  name: string;
  category: string;
  city: string;
  neighborhood: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  price_level: number;
  tags: string | null;
  reliability_score: number;
  partner_status: string;
  notes: string | null;
}

export interface ConfirmedBookingRow {
  id: number;
  request_id: number;
  business_id: number | null;
  business_name: string | null;
  confirmed_date: string;
  confirmed_time: string;
  confirmation_name: string | null;
  confirmation_code: string | null;
  venue_contact_phone: string | null;
  address: string | null;
  instructions: string | null;
  cancellation_policy: string | null;
  approval_status: "pending" | "approved" | "rejected";
}
