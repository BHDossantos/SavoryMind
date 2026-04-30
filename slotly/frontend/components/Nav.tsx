"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuth, getStoredUser, type User } from "@/lib/api";

export default function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
    const onStorage = () => setUser(getStoredUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function logout() {
    clearAuth();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Slotly
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/search" className="hover:underline">
            Find a slot
          </Link>
          {user?.role === "customer" && (
            <Link href="/appointments" className="hover:underline">
              My appointments
            </Link>
          )}
          {user?.role === "provider" && (
            <Link href="/provider" className="hover:underline">
              Provider dashboard
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <span className="text-slate-500">Hi, {user.first_name}</span>
              <button onClick={logout} className="text-slate-500 hover:text-ink">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-ink px-3 py-1.5 text-white hover:bg-slate-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
