import { STATUS_LABELS } from "@/lib/bookings";
import type { RequestStatus } from "@/lib/db";

const styles: Record<RequestStatus, string> = {
  submitted: "bg-ink/10 text-ink",
  in_review: "bg-blue-100 text-blue-800",
  searching: "bg-blue-100 text-blue-800",
  contacting: "bg-amber-100 text-amber-800",
  needs_approval: "bg-purple-100 text-purple-800",
  confirmed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-ink/10 text-ink/60",
  completed: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge ${styles[status]}`}>{STATUS_LABELS[status]}</span>;
}
