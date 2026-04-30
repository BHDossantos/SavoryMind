import { db } from "./db";
import type { BookingRequestRow, ConfirmedBookingRow, RequestStatus } from "./db";

export type NotificationKind =
  | "welcome"
  | "request_received"
  | "in_progress"
  | "needs_approval"
  | "confirmed"
  | "failed"
  | "cancelled";

interface UserContact {
  id: number;
  email: string;
  first_name: string | null;
}

interface Template {
  subject: string;
  body: string;
}

const STATUS_TO_KIND: Partial<Record<RequestStatus, NotificationKind>> = {
  in_review: "in_progress",
  searching: "in_progress",
  contacting: "in_progress",
  needs_approval: "needs_approval",
  confirmed: "confirmed",
  failed: "failed",
  cancelled: "cancelled",
};

export function statusKind(status: RequestStatus): NotificationKind | null {
  return STATUS_TO_KIND[status] ?? null;
}

function template(
  kind: NotificationKind,
  user: UserContact,
  request?: BookingRequestRow,
  confirmation?: ConfirmedBookingRow | null,
): Template {
  const name = user.first_name ?? "there";
  const reqLine = request
    ? `${describeCategory(request.category)} on ${request.date_requested ?? "an unspecified date"}${
        request.time_requested ? " at " + request.time_requested : ""
      } for ${request.party_size}`
    : "your booking";
  switch (kind) {
    case "welcome":
      return {
        subject: "Welcome to Slotly",
        body: `Hi ${name},\n\nThanks for signing up. Tell us what you want booked and we'll handle the rest.\n\n— Slotly`,
      };
    case "request_received":
      return {
        subject: "We received your booking request",
        body: `Hi ${name},\n\nWe got your request for ${reqLine}. We'll start working on it now.\n\n— Slotly`,
      };
    case "in_progress":
      return {
        subject: "We're working on your booking",
        body: `Hi ${name},\n\nWe're contacting venues for ${reqLine}. We'll let you know as soon as we have something.\n\n— Slotly`,
      };
    case "needs_approval": {
      const detail = confirmation
        ? `${confirmation.business_name} on ${confirmation.confirmed_date} at ${confirmation.confirmed_time}`
        : "an alternative option";
      return {
        subject: "We found an option — your approval needed",
        body: `Hi ${name},\n\nWe found ${detail}. Open the app to approve it or ask us to keep looking.\n\n— Slotly`,
      };
    }
    case "confirmed": {
      const detail = confirmation
        ? `${confirmation.business_name} on ${confirmation.confirmed_date} at ${confirmation.confirmed_time}${
            confirmation.address ? " · " + confirmation.address : ""
          }`
        : "your venue";
      return {
        subject: "Your booking is confirmed",
        body: `Hi ${name},\n\nYou're booked: ${detail}.\n\n— Slotly`,
      };
    }
    case "failed":
      return {
        subject: "We couldn't complete this booking",
        body: `Hi ${name},\n\nWe couldn't confirm ${reqLine}. Open the app to try a different time or place.\n\n— Slotly`,
      };
    case "cancelled":
      return {
        subject: "Your booking request was cancelled",
        body: `Hi ${name},\n\n${reqLine} has been cancelled.\n\n— Slotly`,
      };
  }
}

function describeCategory(category: string) {
  return (
    {
      restaurant: "your restaurant booking",
      bar: "your bar / aperitivo booking",
      nightlife: "your nightlife plans",
      salon: "your salon / barber appointment",
      fitness: "your class booking",
      custom: "your booking",
    }[category] ?? "your booking"
  );
}

export const MAX_ATTEMPTS = 5;

export interface NotifyInput {
  userId: number;
  requestId?: number | null;
  kind: NotificationKind;
}

/**
 * Enqueue a notification. Synchronous SQLite insert — never calls Resend
 * inline. The worker (src/lib/notifyWorker.ts) drains the queue with
 * exponential backoff, so a Resend outage doesn't lose events.
 */
export function notify(input: NotifyInput): void {
  const user = db
    .prepare("SELECT id, email, first_name FROM users WHERE id = ?")
    .get(input.userId) as UserContact | undefined;
  if (!user) return;

  let request: BookingRequestRow | undefined;
  let confirmation: ConfirmedBookingRow | null = null;
  if (input.requestId) {
    request = db
      .prepare("SELECT * FROM booking_requests WHERE id = ?")
      .get(input.requestId) as BookingRequestRow | undefined;
    confirmation =
      (db
        .prepare("SELECT * FROM confirmed_bookings WHERE request_id = ?")
        .get(input.requestId) as ConfirmedBookingRow | undefined) ?? null;
  }

  const tpl = template(input.kind, user, request, confirmation);
  const channel = process.env.RESEND_API_KEY ? "email" : "console";

  db.prepare(
    `INSERT INTO notifications (user_id, request_id, channel, subject, body)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(user.id, input.requestId ?? null, channel, tpl.subject, tpl.body);
}

export interface PendingNotification {
  id: number;
  user_email: string;
  channel: string;
  subject: string;
  body: string;
  attempts: number;
}

export function claimPending(limit: number): PendingNotification[] {
  return db
    .prepare(
      `SELECT n.id, n.subject, n.body, n.channel, n.attempts, u.email AS user_email
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE n.delivered_at IS NULL
         AND n.attempts < ?
         AND n.next_attempt_at <= datetime('now')
       ORDER BY n.id ASC
       LIMIT ?`,
    )
    .all(MAX_ATTEMPTS, limit) as PendingNotification[];
}

export async function dispatch(row: PendingNotification): Promise<void> {
  if (row.channel === "email" && process.env.RESEND_API_KEY) {
    await sendViaResend({ to: row.user_email, subject: row.subject, body: row.body });
  } else {
    console.log(
      `[notify:console] to=${row.user_email} subject="${row.subject}"\n${row.body}\n`,
    );
  }
}

export function markDelivered(id: number): void {
  db.prepare(
    `UPDATE notifications SET delivered_at = datetime('now'), error = NULL WHERE id = ?`,
  ).run(id);
}

export function markFailed(id: number, attempts: number, err: unknown): void {
  const msg = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
  const nextAttempts = attempts + 1;
  const backoffSeconds = Math.min(60 * 60, 30 * 2 ** attempts);
  db.prepare(
    `UPDATE notifications
     SET attempts = ?,
         error = ?,
         next_attempt_at = datetime('now', ?)
     WHERE id = ?`,
  ).run(nextAttempts, msg, `+${backoffSeconds} seconds`, id);
}

async function sendViaResend(opts: { to: string; subject: string; body: string }) {
  const from = process.env.NOTIFICATION_FROM ?? "Slotly <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.body,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
  }
}
