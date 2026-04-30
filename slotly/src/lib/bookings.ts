import { db } from "./db";
import type {
  BookingRequestRow,
  BusinessRow,
  ConfirmedBookingRow,
  RequestStatus,
} from "./db";
import { notify, statusKind } from "./notifications";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  searching: "Searching",
  contacting: "Contacting venues",
  needs_approval: "Needs your approval",
  confirmed: "Confirmed",
  failed: "Couldn't confirm",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  bar: "Bar / aperitivo",
  nightlife: "Nightlife",
  salon: "Salon / barber",
  fitness: "Fitness / class",
  custom: "Custom",
};

export function listMyRequests(userId: number): BookingRequestRow[] {
  return db
    .prepare(
      `SELECT * FROM booking_requests WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as BookingRequestRow[];
}

export function getRequest(id: number): BookingRequestRow | undefined {
  return db
    .prepare("SELECT * FROM booking_requests WHERE id = ?")
    .get(id) as BookingRequestRow | undefined;
}

export function getConfirmedBooking(requestId: number): ConfirmedBookingRow | undefined {
  return db
    .prepare("SELECT * FROM confirmed_bookings WHERE request_id = ?")
    .get(requestId) as ConfirmedBookingRow | undefined;
}

export function getStatusHistory(requestId: number) {
  return db
    .prepare(
      `SELECT * FROM status_history WHERE request_id = ? ORDER BY created_at ASC`,
    )
    .all(requestId) as Array<{
      id: number;
      old_status: string | null;
      new_status: string;
      notes: string | null;
      created_at: string;
    }>;
}

export function getContactAttempts(requestId: number) {
  return db
    .prepare(
      `SELECT ca.*, b.name AS business_name
       FROM contact_attempts ca
       LEFT JOIN businesses b ON b.id = ca.business_id
       WHERE ca.request_id = ?
       ORDER BY ca.created_at ASC`,
    )
    .all(requestId) as Array<{
      id: number;
      method: string;
      result: string | null;
      notes: string | null;
      created_at: string;
      business_name: string | null;
    }>;
}

interface CreateRequestInput {
  userId: number;
  category: string;
  rawText?: string | null;
  city?: string;
  neighborhood?: string | null;
  date?: string | null;
  time?: string | null;
  partySize: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  vibe?: string | null;
  specialRequests?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  priority?: "normal" | "priority" | "vip";
}

export function createRequest(input: CreateRequestInput): BookingRequestRow {
  const result = db
    .prepare(
      `INSERT INTO booking_requests (
        user_id, category, raw_request_text, city, neighborhood,
        date_requested, time_requested, party_size,
        budget_min, budget_max, vibe, special_requests,
        contact_name, contact_phone, priority, status
      ) VALUES (
        @userId, @category, @rawText, @city, @neighborhood,
        @date, @time, @partySize,
        @budgetMin, @budgetMax, @vibe, @specialRequests,
        @contactName, @contactPhone, @priority, 'submitted'
      )`,
    )
    .run({
      userId: input.userId,
      category: input.category,
      rawText: input.rawText ?? null,
      city: input.city ?? "Rome",
      neighborhood: input.neighborhood ?? null,
      date: input.date ?? null,
      time: input.time ?? null,
      partySize: input.partySize,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      vibe: input.vibe ?? null,
      specialRequests: input.specialRequests ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      priority: input.priority ?? "normal",
    });
  const id = Number(result.lastInsertRowid);
  recordStatus(id, null, "submitted", input.userId, "Request submitted");
  matchCandidates(id);
  void notify({ userId: input.userId, requestId: id, kind: "request_received" });
  return getRequest(id)!;
}

export function recordStatus(
  requestId: number,
  oldStatus: string | null,
  newStatus: RequestStatus,
  changedBy: number | null,
  notes?: string | null,
) {
  db.prepare(
    `INSERT INTO status_history (request_id, old_status, new_status, changed_by, notes)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(requestId, oldStatus, newStatus, changedBy, notes ?? null);
  db.prepare(
    `UPDATE booking_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(newStatus, requestId);
}

export function setStatus(
  requestId: number,
  newStatus: RequestStatus,
  changedBy: number | null,
  notes?: string | null,
) {
  const cur = getRequest(requestId);
  if (!cur) return;
  if (cur.status === newStatus) return;
  recordStatus(requestId, cur.status, newStatus, changedBy, notes);
  const kind = statusKind(newStatus);
  if (kind && shouldNotify(cur.status, newStatus)) {
    void notify({ userId: cur.user_id, requestId, kind });
  }
}

function shouldNotify(oldStatus: RequestStatus, newStatus: RequestStatus): boolean {
  // Don't spam users every time admin toggles between in_review/searching/contacting.
  const inProgress: RequestStatus[] = ["in_review", "searching", "contacting"];
  if (inProgress.includes(oldStatus) && inProgress.includes(newStatus)) return false;
  return true;
}

export function matchCandidates(requestId: number) {
  const req = getRequest(requestId);
  if (!req) return;
  const businesses = db
    .prepare("SELECT * FROM businesses WHERE city = ? AND category = ?")
    .all(req.city, req.category) as BusinessRow[];

  const scored = businesses.map((b) => {
    let score = 0;
    let reasons: string[] = [];
    score += 25; // category match (already filtered)
    reasons.push("category");
    if (req.neighborhood && b.neighborhood && b.neighborhood.toLowerCase() === req.neighborhood.toLowerCase()) {
      score += 20;
      reasons.push("neighborhood");
    } else if (req.neighborhood && b.neighborhood) {
      score += 5;
    }
    if (req.budget_max && b.price_level) {
      const targetLevel = req.budget_max <= 30 ? 1 : req.budget_max <= 60 ? 2 : req.budget_max <= 120 ? 3 : 4;
      if (b.price_level <= targetLevel) {
        score += 15;
        reasons.push("budget");
      }
    } else {
      score += 8;
    }
    if (req.vibe && b.tags) {
      const vibe = req.vibe.toLowerCase();
      const tags = b.tags.toLowerCase();
      if (tags.split(",").some((t) => vibe.includes(t.trim()) || t.trim().includes(vibe))) {
        score += 10;
        reasons.push("vibe");
      }
    }
    score += Math.round((b.reliability_score ?? 70) / 10);
    return { business: b, score, reason: reasons.join(", ") };
  });

  scored.sort((a, b) => b.score - a.score);
  const stmt = db.prepare(
    `INSERT INTO candidate_businesses (request_id, business_id, match_score, reason)
     VALUES (?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const s of scored.slice(0, 5)) {
      stmt.run(requestId, s.business.id, s.score, s.reason);
    }
  });
  tx();
}

export function getCandidates(requestId: number) {
  return db
    .prepare(
      `SELECT cb.*, b.name AS business_name, b.address, b.phone, b.whatsapp, b.neighborhood, b.tags
       FROM candidate_businesses cb
       JOIN businesses b ON b.id = cb.business_id
       WHERE cb.request_id = ?
       ORDER BY cb.match_score DESC`,
    )
    .all(requestId) as Array<{
      id: number;
      business_id: number;
      match_score: number;
      reason: string | null;
      contact_status: string;
      business_name: string;
      address: string | null;
      phone: string | null;
      whatsapp: string | null;
      neighborhood: string | null;
      tags: string | null;
    }>;
}

export function logContactAttempt(input: {
  requestId: number;
  businessId?: number | null;
  method: string;
  result?: string | null;
  notes?: string | null;
  contactedBy: number;
}) {
  db.prepare(
    `INSERT INTO contact_attempts (request_id, business_id, method, result, notes, contacted_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.requestId,
    input.businessId ?? null,
    input.method,
    input.result ?? null,
    input.notes ?? null,
    input.contactedBy,
  );
}

export interface ConfirmInput {
  requestId: number;
  businessId?: number | null;
  businessName?: string | null;
  date: string;
  time: string;
  confirmationName?: string | null;
  confirmationCode?: string | null;
  venueContactPhone?: string | null;
  address?: string | null;
  instructions?: string | null;
  cancellationPolicy?: string | null;
  needsApproval: boolean;
  changedBy: number;
}

export function upsertConfirmation(input: ConfirmInput) {
  const existing = getConfirmedBooking(input.requestId);
  const approvalStatus = input.needsApproval ? "pending" : "approved";
  if (existing) {
    db.prepare(
      `UPDATE confirmed_bookings SET
        business_id = ?, business_name = ?, confirmed_date = ?, confirmed_time = ?,
        confirmation_name = ?, confirmation_code = ?, venue_contact_phone = ?,
        address = ?, instructions = ?, cancellation_policy = ?, approval_status = ?
       WHERE request_id = ?`,
    ).run(
      input.businessId ?? null,
      input.businessName ?? null,
      input.date,
      input.time,
      input.confirmationName ?? null,
      input.confirmationCode ?? null,
      input.venueContactPhone ?? null,
      input.address ?? null,
      input.instructions ?? null,
      input.cancellationPolicy ?? null,
      approvalStatus,
      input.requestId,
    );
  } else {
    db.prepare(
      `INSERT INTO confirmed_bookings (
        request_id, business_id, business_name, confirmed_date, confirmed_time,
        confirmation_name, confirmation_code, venue_contact_phone,
        address, instructions, cancellation_policy, approval_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.requestId,
      input.businessId ?? null,
      input.businessName ?? null,
      input.date,
      input.time,
      input.confirmationName ?? null,
      input.confirmationCode ?? null,
      input.venueContactPhone ?? null,
      input.address ?? null,
      input.instructions ?? null,
      input.cancellationPolicy ?? null,
      approvalStatus,
    );
  }
  setStatus(
    input.requestId,
    input.needsApproval ? "needs_approval" : "confirmed",
    input.changedBy,
    input.needsApproval ? "Alternative found, awaiting user approval" : "Booking confirmed",
  );
}

export function approveOption(requestId: number, userId: number) {
  const c = getConfirmedBooking(requestId);
  if (!c) return;
  db.prepare(
    `UPDATE confirmed_bookings SET approval_status = 'approved' WHERE request_id = ?`,
  ).run(requestId);
  setStatus(requestId, "confirmed", userId, "User approved alternative");
}

export function rejectOption(requestId: number, userId: number) {
  const c = getConfirmedBooking(requestId);
  if (!c) return;
  db.prepare(
    `UPDATE confirmed_bookings SET approval_status = 'rejected' WHERE request_id = ?`,
  ).run(requestId);
  setStatus(requestId, "searching", userId, "User rejected alternative — searching again");
}

export function cancelRequest(requestId: number, userId: number) {
  setStatus(requestId, "cancelled", userId, "Cancelled by user");
}

export function adminListQueue(filter?: { status?: string; category?: string }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.status) {
    where.push("br.status = ?");
    params.push(filter.status);
  }
  if (filter?.category) {
    where.push("br.category = ?");
    params.push(filter.category);
  }
  const sql = `
    SELECT br.*, u.email AS user_email, u.first_name AS user_first_name
    FROM booking_requests br
    JOIN users u ON u.id = br.user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY
      CASE br.priority WHEN 'vip' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END,
      br.created_at DESC
  `;
  return db.prepare(sql).all(...params) as Array<
    BookingRequestRow & { user_email: string; user_first_name: string | null }
  >;
}
