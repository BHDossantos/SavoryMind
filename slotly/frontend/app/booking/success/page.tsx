"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, getStoredUser } from "@/lib/api";

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Confirming…</p>}>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const params = useSearchParams();
  const router = useRouter();
  const stub = params.get("stub") === "1";
  const paymentId = params.get("payment_id");

  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Finalising your deposit…");

  useEffect(() => {
    if (!getStoredUser()) {
      router.push("/login?next=/booking/success");
      return;
    }
    async function run() {
      if (stub && paymentId) {
        try {
          await api.stubConfirmPayment(Number(paymentId));
          setState("ok");
          setMessage("Deposit received. Your booking is confirmed.");
        } catch (e) {
          setState("error");
          setMessage((e as Error).message);
        }
        return;
      }
      // Real Stripe path: Stripe webhook flips the appointment to paid.
      // We just confirm the redirect arrived.
      setState("ok");
      setMessage(
        "Payment processing. Your booking will appear under My appointments once confirmed."
      );
    }
    run();
  }, [stub, paymentId, router]);

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-bold">
        {state === "ok" ? "Booking confirmed" : state === "error" ? "Something went wrong" : "Working…"}
      </h1>
      <p className={state === "error" ? "text-red-600" : "text-slate-600"}>{message}</p>
      <div className="flex justify-center gap-2">
        <Link
          href="/appointments"
          className="rounded-md bg-accent px-5 py-2 font-semibold text-white hover:bg-emerald-600"
        >
          See my appointments
        </Link>
      </div>
    </div>
  );
}
