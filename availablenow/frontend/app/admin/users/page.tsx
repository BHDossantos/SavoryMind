"use client";

import { useEffect, useState } from "react";
import { api, type AdminUser, type Role } from "@/lib/api";

const ROLES: ("all" | Role)[] = ["all", "customer", "provider", "admin"];

export default function AdminUsersPage() {
  const [role, setRole] = useState<"all" | Role>("all");
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    api
      .adminUsers(role === "all" ? undefined : role)
      .then(setItems)
      .catch((e) => setError(String(e.message || e)));
  }, [role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              role === r
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-slate-500">Loading…</p>}

      {items && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>#</Th>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => (
                <tr key={u.id}>
                  <Td>{u.id}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    {u.first_name} {u.last_name}
                  </Td>
                  <Td>{u.role}</Td>
                  <Td>{new Date(u.created_at).toLocaleDateString("en-GB")}</Td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
