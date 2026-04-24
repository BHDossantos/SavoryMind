import Link from "next/link";
import { useAuth } from "../context/AuthContext";

function homePath(user) {
  if (!user) return "/login";
  if (user.account_type === "consumer") return "/consumer/dashboard";
  if (user.account_type === "diner") return "/diner/dashboard";
  if (user.account_type === "staff") return "/staff-portal";
  return "/dashboard";
}

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-4">🍽️</div>
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">This page is off the menu</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          The page you were looking for doesn't exist or has been moved.
        </p>
        <Link
          href={homePath(user)}
          className="inline-block bg-gray-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          Back to SavoryMind
        </Link>
      </div>
    </div>
  );
}
