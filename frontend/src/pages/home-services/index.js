// AvailableNow Home — landing page for the home & local services vertical.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../services/api";

const CATEGORY_META = {
  cleaning: { icon: "🧽", label: "Cleaning", desc: "Apartment, deep clean, Airbnb turnover" },
  handyman: { icon: "🛠️", label: "Handyman", desc: "Mounting, repairs, small jobs" },
  plumbing: { icon: "🚰", label: "Plumbing", desc: "Leaks, fixtures, drains" },
  furniture_assembly: { icon: "🪑", label: "Furniture assembly", desc: "IKEA, flatpack, mounting" },
  moving: { icon: "📦", label: "Moving help", desc: "Loaders, small moves, hauling" },
  painting: { icon: "🎨", label: "Painting", desc: "Walls, touch-ups, accent jobs" },
  appliance_repair: { icon: "🔧", label: "Appliance repair", desc: "Washer, oven, fridge" },
  locksmith: { icon: "🔑", label: "Locksmith", desc: "Lockouts, lock changes" },
  gardening: { icon: "🌿", label: "Gardening", desc: "Trimming, cleanup, planting" },
  electrical: { icon: "💡", label: "Electrical", desc: "Outlets, fixtures, lighting" },
  hvac: { icon: "❄️", label: "AC / Heating", desc: "Diagnostics, install, repair" },
  pest_control: { icon: "🐜", label: "Pest control", desc: "Inspection and treatment" },
  it_support: { icon: "💻", label: "IT / Internet", desc: "Wifi, smart home, setup" },
};

export default function HomeServicesLanding() {
  const [categories, setCategories] = useState(Object.keys(CATEGORY_META));

  useEffect(() => {
    api
      .getHomeCategories()
      .then((res) => res?.categories && setCategories(res.categories))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-bold">AvailableNow Home</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/home-services/jobs" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              My jobs
            </Link>
            <Link
              href="/home-services/provider"
              className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              I'm a pro
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Trusted help at home, available now.
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl">
          Cleaning, plumbing, handyman, moving and repair — request a job, compare quotes, book a verified pro.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/home-services/request"
            className="bg-gray-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Request a service
          </Link>
          <Link
            href="/home-services/jobs"
            className="border border-gray-300 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50"
          >
            Track my jobs
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-6">What do you need fixed or done?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((c) => {
            const meta = CATEGORY_META[c] || { icon: "🔧", label: c, desc: "" };
            return (
              <Link
                key={c}
                href={`/home-services/request?category=${c}`}
                className="border border-gray-200 rounded-xl p-5 hover:border-gray-900 hover:shadow-sm transition"
              >
                <div className="text-3xl">{meta.icon}</div>
                <div className="mt-3 font-semibold">{meta.label}</div>
                <div className="text-sm text-gray-500">{meta.desc}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
