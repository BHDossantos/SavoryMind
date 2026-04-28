import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  getCandidates,
  getConfirmedBooking,
  getContactAttempts,
  getRequest,
  getStatusHistory,
} from "@/lib/bookings";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminRequestPanel } from "@/components/AdminRequestPanel";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const id = Number(params.id);
  const request = getRequest(id);
  if (!request) notFound();

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(request.user_id) as
    | { email: string; first_name: string | null; last_name: string | null; phone: string | null }
    | undefined;
  const candidates = getCandidates(id);
  const confirmation = getConfirmedBooking(id);
  const history = getStatusHistory(id);
  const attempts = getContactAttempts(id);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-ink/60 underline">
          ← Queue
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              #{request.id} · {CATEGORY_LABELS[request.category] ?? request.category}
            </h1>
            <p className="text-ink/60">
              {user?.first_name ?? user?.email} · {user?.phone ?? "no phone"} ·{" "}
              <span className="lowercase">{request.priority}</span>
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">Request</h2>
          <dl className="space-y-2 text-sm">
            <Field label="When" value={`${request.date_requested ?? "—"} ${request.time_requested ?? ""}`} />
            <Field label="Where" value={`${request.city}${request.neighborhood ? " · " + request.neighborhood : ""}`} />
            <Field label="Party" value={String(request.party_size)} />
            <Field label="Budget" value={budgetText(request.budget_min, request.budget_max)} />
            <Field label="Vibe" value={request.vibe} />
            <Field label="Special" value={request.special_requests} />
            <Field label="Booking name" value={request.contact_name} />
            <Field label="Phone" value={request.contact_phone} />
          </dl>
          {request.raw_request_text && (
            <p className="mt-3 rounded-lg bg-cream p-3 text-sm italic">
              "{request.raw_request_text}"
            </p>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">
            Candidate venues
          </h2>
          {candidates.length === 0 ? (
            <p className="text-ink/60">No candidates matched. Search the directory or contact custom venues.</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <div key={c.id} className="card flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{c.business_name}</div>
                    <div className="text-sm text-ink/60">
                      {c.neighborhood ?? ""} · {c.address ?? ""}
                    </div>
                    <div className="text-xs text-ink/50">
                      tags: {c.tags ?? "—"} · score {c.match_score} ({c.reason ?? "—"})
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {c.phone && <div>📞 {c.phone}</div>}
                    {c.whatsapp && <div>💬 {c.whatsapp}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AdminRequestPanel
        requestId={request.id}
        candidates={candidates}
        defaults={{
          date: request.date_requested ?? new Date().toISOString().slice(0, 10),
          time: request.time_requested ?? "20:00",
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">Contact log</h2>
        {attempts.length === 0 ? (
          <p className="text-ink/60">No attempts yet.</p>
        ) : (
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li key={a.id} className="card py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {a.business_name ?? "—"} · {a.method} → {a.result}
                  </div>
                  <div className="text-xs text-ink/50">
                    {new Date(a.created_at + "Z").toLocaleString()}
                  </div>
                </div>
                {a.notes && <div className="text-ink/70">{a.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink/60">Status history</h2>
        <ol className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
              <span>
                {STATUS_LABELS[h.new_status as keyof typeof STATUS_LABELS] ?? h.new_status}
                {h.notes && <span className="text-ink/60"> — {h.notes}</span>}
              </span>
              <span className="text-xs text-ink/50">{new Date(h.created_at + "Z").toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>

      {confirmation && (
        <section className="card border-green-300 bg-green-50">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-green-900">
            Current confirmation ({confirmation.approval_status})
          </h2>
          <div className="text-sm">
            {confirmation.business_name} · {confirmation.confirmed_date} {confirmation.confirmed_time}
            {confirmation.address && <> · {confirmation.address}</>}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/50">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function budgetText(min: number | null, max: number | null) {
  if (min && max) return `€${min}–€${max}`;
  if (max) return `up to €${max}`;
  if (min) return `from €${min}`;
  return null;
}
