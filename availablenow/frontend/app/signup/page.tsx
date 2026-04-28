"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, storeAuth, type Role } from "@/lib/api";

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "customer" as Role,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { access_token, user } = await api.signup(form);
      storeAuth(access_token, user);
      const dest = user.role === "provider" ? "/provider" : next;
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-bold">Create your account</h1>

      <div className="flex gap-2 text-sm">
        {(["customer", "provider"] as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => update("role", r)}
            className={`flex-1 rounded-md border py-2 ${
              form.role === r
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white"
            }`}
          >
            I'm a {r}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-2">
          <input
            required
            value={form.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            placeholder="First name"
            className="w-full rounded-md border border-slate-300 p-2"
          />
          <input
            value={form.last_name}
            onChange={(e) => update("last_name", e.target.value)}
            placeholder="Last name"
            className="w-full rounded-md border border-slate-300 p-2"
          />
        </div>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border border-slate-300 p-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          placeholder="Password (min 6 chars)"
          className="w-full rounded-md border border-slate-300 p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
