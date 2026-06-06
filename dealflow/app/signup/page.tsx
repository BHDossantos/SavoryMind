"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const fields = body.fields ?? { _: body.error ?? "Signup failed" };
        setErrors(fields);
        return;
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setErrors({ _: "Signed up, but auto-login failed. Try logging in." });
        router.push("/login");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setErrors({ _: e instanceof Error ? e.message : "Signup failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Free tier — 3 saved deals, no card required.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Name (optional)</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            {errors.name && (
              <div className="mt-1 text-xs text-rose-700">{errors.name}</div>
            )}
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && (
              <div className="mt-1 text-xs text-rose-700">{errors.email}</div>
            )}
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {errors.password && (
              <div className="mt-1 text-xs text-rose-700">{errors.password}</div>
            )}
          </div>
          {errors._ && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {errors._}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-700 underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
