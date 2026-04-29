"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/api";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (u.role !== "admin") {
      router.push("/");
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-slate-500 hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
