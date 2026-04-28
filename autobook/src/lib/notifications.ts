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
        subject: "Welcome to AutoBook",
        body: `Hi ${name},\n\nThanks for signing up. Tell us what you want booked and we'll handle the rest.\n\n— AutoBook`,
      };
    case "request_received":
      return {
        subject: "We received your booking request",
        body: `Hi ${name},\n\nWe got your request for ${reqLine}. We'll start working on it now.\n\n— AutoBook`,
      };
    case "in_progress":
      return {
        subject: "We're working on your booking",
        body: `Hi ${name},\n\nWe're contacting venues for ${reqLine}. We'll let you know as soon as we have something.\n\n— AutoBook`,
      };
    case "needs_approval": {
      const detail = confirmation
        ? `${confirmation.business_name} on ${confirmation.confirmed_date} at ${confirmation.confirmed_time}`
        : "an alternative option";
      return {
        subject: "We found an option — your approval needed",
        body: `Hi ${name},\n\nWe found ${detail}. Open the app to approve it or ask us to keep looking.\n\n— AutoBook`,
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
        body: `Hi ${name},\n\nYou're booked: ${detail}.\n\n— AutoBook`,
      };
    }
    case "failed":
      return {
        subject: "We couldn't complete this booking",
        body: `Hi ${name},\n\nWe couldn't confirm ${reqLine}. Open the app to try a different time or place.\n\n— AutoBook`,
      };
    case "cancelled":
      return {
        subject: "Your booking request was cancelled",
        body: `Hi ${name},\n\n${reqLine} has been cancelled.\n\n— AutoBook`,
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

export interface NotifyInput {
  userId: number;
  requestId?: number | null;
  kind: NotificationKind;
}

export async function notify(input: NotifyInput): Promise<void> {
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

  const insert = db.prepare(
    `INSERT INTO notifications (user_id, request_id, channel, subject, body)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const result = insert.run(
    user.id,
    input.requestId ?? null,
    channel,
    tpl.subject,
    tpl.body,
  );
  const notificationId = Number(result.lastInsertRowid);

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to: user.email, ...tpl });
    } else {
      console.log(
        `[notify:console] to=${user.email} subject="${tpl.subject}"\n${tpl.body}\n`,
      );
    }
    db.prepare(
      `UPDATE notifications SET delivered_at = datetime('now') WHERE id = ?`,
    ).run(notificationId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notify] delivery failed: ${msg}`);
    db.prepare(`UPDATE notifications SET error = ? WHERE id = ?`).run(msg, notificationId);
  }
}

async function sendViaResend(opts: { to: string; subject: string; body: string }) {
  const from = process.env.NOTIFICATION_FROM ?? "AutoBook <onboarding@resend.dev>";
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
