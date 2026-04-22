import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

const TYPES = [
  {
    id: "consumer",
    icon: "🏠",
    title: "Home Cook",
    subtitle: "Wine, beer, spirits & recipes",
    border: "border-consumer-500 bg-consumer-50",
    borderDefault: "border-gray-200 hover:border-consumer-300",
    accent: "bg-consumer-600 hover:bg-consumer-700 focus:ring-consumer-400",
    label: "Home Cook",
  },
  {
    id: "diner",
    icon: "🍽️",
    title: "Diner",
    subtitle: "Bookings, visits & ratings",
    border: "border-diner-500 bg-diner-50",
    borderDefault: "border-gray-200 hover:border-diner-300",
    accent: "bg-diner-600 hover:bg-diner-700 focus:ring-diner-400",
    label: "Diner",
  },
  {
    id: "restaurant",
    icon: "🏪",
    title: "Restaurant",
    subtitle: "Analytics, CRM & waste tracking",
    border: "border-brand-500 bg-brand-50",
    borderDefault: "border-gray-200 hover:border-brand-300",
    accent: "bg-brand-600 hover:bg-brand-700 focus:ring-brand-400",
    label: "Restaurant",
  },
];

export default function Signup() {
  const { register } = useAuth();
  const router = useRouter();
  const [accountType, setAccountType] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = router.query.type;
    if (["consumer", "diner", "restaurant"].includes(t)) setAccountType(t);
  }, [router.query.type]);

  const handleChange = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountType) { setError("Please choose an account type above."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(null);
    try {
      await register(form.email, form.password, form.display_name, accountType);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selected = TYPES.find((t) => t.id === accountType);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl">🧠</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-brand-600 via-diner-500 to-consumer-600 bg-clip-text text-transparent">
              SavoryMind
            </span>
          </Link>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-5">Choose your experience</h1>

          {/* Type selector */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setAccountType(type.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${accountType === type.id ? type.border : type.borderDefault}`}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <p className="font-bold text-xs text-gray-900">{type.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{type.subtitle}</p>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {accountType === "restaurant" ? "Restaurant name" : "Your name"}
              </label>
              <input
                type="text" name="display_name" value={form.display_name} onChange={handleChange}
                required minLength={2}
                placeholder={accountType === "restaurant" ? "The Blue Plate" : "Your full name"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" name="email" value={form.email} onChange={handleChange}
                required placeholder="you@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password" name="password" value={form.password} onChange={handleChange}
                required placeholder="Min 6 characters"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !accountType}
              className={`w-full text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 ${selected ? selected.accent : "bg-gray-300 cursor-not-allowed"}`}
            >
              {loading
                ? "Creating account..."
                : selected
                  ? `Create ${selected.label} Account`
                  : "Select an option above"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-gray-900 font-medium hover:underline">Sign in</Link>
          </p>

          <p className="text-center text-xs text-gray-400 mt-3">
            Demo data pre-loaded automatically on signup.
          </p>
        </div>
      </div>
    </div>
  );
}
