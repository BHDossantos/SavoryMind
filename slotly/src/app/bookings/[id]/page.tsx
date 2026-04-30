import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  getConfirmedBooking,
  getRequest,
  getStatusHistory,
} from "@/lib/bookings";
import { StatusBadge } from "@/components/StatusBadge";
import { RequestActions } from "@/components/RequestActions";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = Number((await params).id);
  const request = getRequest(id);
  if (!request) notFound();
  if (request.user_id !== session.userId && session.role !== "admin") notFound();

  const confirmation = getConfirmedBooking(id);
  const history = getStatusHistory(id);

  const canApprove = request.status === "needs_approval";
  const canCancel = !["completed", "cancelled", "failed"].includes(request.status);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/bookings" className="text-sm text-ink/60 underline">
            ← My bookings
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {CATEGORY_LABELS[request.category] ?? request.category}
            {request.neighborhood ? ` · ${request.neighborhood}` : ""}
          </h1>
          <p className="text-ink/60">
            Requested {request.date_requested ?? "—"} {request.time_requested ?? ""} · party of {request.party_size}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.status === "needs_approval" && confirmation && (
        <div className="card border-purple-300 bg-purple-50">
          <h2 className="text-lg font-semibold">We found an option — does this work?</h2>
          <p className="mt-1 text-ink/80">
            {confirmation.business_name} on {confirmation.confirmed_date} at {confirmation.confirmed_time}.
          </p>
          {confirmation.address && <p className="text-ink/70">{confirmation.address}</p>}
          {confirmation.instructions && <p className="mt-2 text-sm text-ink/70">{confirmation.instructions}</p>}
          <div className="mt-4">
            <RequestActions requestId={request.id} canApprove canCancel={false} />
          </div>
        </div>
      )}

      {request.status === "confirmed" && confirmation && (
        <div className="card border-green-300 bg-green-50">
          <h2 className="text-lg font-semibold">You're booked.</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Venue" value={confirmation.business_name} />
            <Field label="Date & time" value={`${confirmation.confirmed_date} · ${confirmation.confirmed_time}`} />
            <Field label="Address" value={confirmation.address} />
            <Field label="Booking name" value={confirmation.confirmation_name} />
            <Field label="Confirmation code" value={confirmation.confirmation_code} />
            <Field label="Venue phone" value={confirmation.venue_contact_phone} />
          </dl>
          {confirmation.instructions && (
            <p className="mt-3 text-sm text-ink/70">📝 {confirmation.instructions}</p>
          )}
          {confirmation.cancellation_policy && (
            <p className="mt-1 text-sm text-ink/70">⚠️ {confirmation.cancellation_policy}</p>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">Request</h2>
        <div className="card grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Category" value={CATEGORY_LABELS[request.category]} />
          <Field label="City" value={request.city} />
          <Field label="Neighborhood" value={request.neighborhood} />
          <Field label="Party size" value={String(request.party_size)} />
          <Field label="Budget" value={budgetText(request.budget_min, request.budget_max)} />
          <Field label="Vibe" value={request.vibe} />
          <Field label="Booking name" value={request.contact_name} />
          <Field label="Phone" value={request.contact_phone} />
        </div>
        {request.raw_request_text && (
          <p className="mt-3 rounded-xl bg-white p-4 text-sm italic text-ink/70">
            "{request.raw_request_text}"
          </p>
        )}
        {request.special_requests && (
          <p className="mt-3 text-sm text-ink/70">
            <strong>Special requests:</strong> {request.special_requests}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">Timeline</h2>
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="card flex items-start gap-3 py-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-accent" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {STATUS_LABELS[h.new_status as keyof typeof STATUS_LABELS] ?? h.new_status}
                </div>
                {h.notes && <div className="text-sm text-ink/60">{h.notes}</div>}
              </div>
              <div className="text-xs text-ink/50">
                {new Date(h.created_at + "Z").toLocaleString()}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <RequestActions
        requestId={request.id}
        canApprove={canApprove}
        canCancel={canCancel && !canApprove}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink/50">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function budgetText(min: number | null, max: number | null) {
  if (min && max) return `€${min}–€${max}`;
  if (max) return `up to €${max}`;
  if (min) return `from €${min}`;
  return null;
}
