import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BookingForm } from "@/components/BookingForm";
import { getSession } from "@/lib/auth";

export default async function NewBookingPage() {
  if (!(await getSession())) redirect("/login");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New booking request</h1>
        <p className="text-ink/70">
          Fill in what you want. We'll handle the calls, messages, and confirmations.
        </p>
      </div>
      <Suspense>
        <BookingForm />
      </Suspense>
    </div>
  );
}
