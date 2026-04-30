"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, storeAuth } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { access_token, user } = await api.login({ email, password });
      storeAuth(access_token, user);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border border-slate-300 p-2"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-slate-300 p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-ink py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-slate-600">
        No account?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="underline">
          Sign up
        </Link>
      </p>
      <p className="rounded bg-slate-100 p-3 text-xs text-slate-600">
        Demo accounts: <code>demo@availablenow.app</code> / <code>password123</code> (customer),{" "}
        <code>marco@romebarbers.it</code> / <code>password123</code> (provider).
      </p>
    </div>
  );
}
