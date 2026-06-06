"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function AuthMenu() {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return <span className="text-xs text-slate-400">…</span>;
  }
  if (!session?.user) {
    return (
      <>
        <Link className="btn-ghost" href="/login">
          Log in
        </Link>
        <Link className="btn-primary" href="/signup">
          Sign up
        </Link>
      </>
    );
  }
  return (
    <>
      <span className="hidden text-xs text-slate-500 sm:inline">
        {session.user.email}
      </span>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    </>
  );
}
