"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Stars from "@/components/Stars";
import { api, getStoredUser, type Appointment } from "@/lib/api";

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = Number(params.id);

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredUser()) {
      router.push(`/login?next=/appointments/${id}/review`);
      return;
    }
    api
      .myAppointments()
      .then((items) => {
        const found = items.find((a) => a.id === id);
        if (!found) {
          setError("Appointment not found.");
          return;
        }
        setAppt(found);
      })
      .catch((e) => setError(String(e.message || e)));
  }, [id, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createReview({ appointment_id: id, rating, comment: comment.trim() });
      router.push("/appointments?reviewed=1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !appt) return <p className="text-red-600">{error}</p>;
  if (!appt) return <p className="text-slate-500">Loading…</p>;
  if (appt.has_review) {
    return (
      <div className="space-y-3">
        <p>You already reviewed this appointment.</p>
      </div>
    );
  }
  if (!appt.can_review) {
    return (
      <p className="text-slate-600">
        This appointment can't be reviewed yet (status: {appt.status}).
      </p>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold">How was it?</h1>
        <p className="text-slate-600">
          {appt.service_name} with {appt.provider_display_name}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Your rating</p>
          <Stars value={rating} onChange={setRating} size="lg" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="comment">
            Comment (optional)
          </label>
          <textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you like? Anything to flag?"
            className="mt-1 w-full rounded-md border border-slate-300 p-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-5 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post review"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-slate-300 px-5 py-2 hover:border-slate-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
