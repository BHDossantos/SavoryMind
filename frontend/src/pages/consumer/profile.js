import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export default function ConsumerProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    display_name: user?.display_name || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null); setSaved(false);
    try {
      await api.updateProfile(form);
      updateUser(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">👤 My Profile</h1>
        <p className="text-gray-400 mt-1">Personalise your SavoryMind experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar preview */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-consumer-100 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-consumer-100 flex items-center justify-center mb-4 overflow-hidden">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
            ) : (
              <span className="text-4xl font-bold text-consumer-500">{form.display_name?.[0]?.toUpperCase() || "U"}</span>
            )}
          </div>
          <h2 className="font-bold text-gray-900 text-xl">{form.display_name || "Your Name"}</h2>
          <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
          <p className="text-gray-600 text-sm mt-3 leading-relaxed">{form.bio || "No bio yet."}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs bg-consumer-100 text-consumer-700 px-3 py-1 rounded-full font-medium">Food Lover</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">Free Plan</span>
          </div>
        </div>

        {/* Edit form */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
          <h2 className="font-semibold text-gray-800 mb-5">Edit Details</h2>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {saved && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">Profile saved!</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={4}
                placeholder="Tell the world about your food & music tastes..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
              <input
                value={form.avatar_url}
                onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
              />
              <p className="text-xs text-gray-400 mt-1">Paste a link to your profile picture.</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-consumer-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
