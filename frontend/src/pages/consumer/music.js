import { useState, useEffect } from "react";
import { api } from "../../services/api";

const MOODS = [
  { value: "romantic",     label: "Romantic",     emoji: "🕯️", desc: "Intimate & Soft" },
  { value: "celebratory",  label: "Celebratory",  emoji: "🎉", desc: "Festive & Uplifting" },
  { value: "casual",       label: "Casual",       emoji: "☀️", desc: "Relaxed & Easy" },
  { value: "focused",      label: "Focused",      emoji: "🎯", desc: "Deep & Productive" },
  { value: "melancholy",   label: "Melancholy",   emoji: "🌧️", desc: "Reflective & Soulful" },
  { value: "energetic",    label: "Energetic",    emoji: "⚡", desc: "High Energy & Bold" },
];

const FOOD_TYPES = [
  { value: "light",   label: "Light & Fresh",   emoji: "🥗" },
  { value: "rich",    label: "Rich & Hearty",   emoji: "🍖" },
  { value: "spicy",   label: "Spicy & Bold",    emoji: "🌶️" },
  { value: "sweet",   label: "Sweet & Delicate",emoji: "🍰" },
  { value: "umami",   label: "Umami & Savory",  emoji: "🍜" },
  { value: "neutral", label: "Mixed / Neutral",  emoji: "🍽️" },
];

const OCCASIONS = [
  { value: "date_night",   label: "Date Night" },
  { value: "dinner_party", label: "Dinner Party" },
  { value: "solo",         label: "Solo Dining" },
  { value: "family",       label: "Family Meal" },
  { value: "work_lunch",   label: "Work Lunch" },
  { value: "brunch",       label: "Weekend Brunch" },
];

export default function MusicMood() {
  const [form, setForm] = useState({ mood: "", food_type: "", occasion: "" });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMusicMoods().then(setHistory).catch(() => {});
    api.getConnections().then(setConnections).catch(() => {});
  }, []);

  const connectedSpotify = connections.find((c) => c.platform === "spotify" && c.connected);
  const connectedAmazon  = connections.find((c) => c.platform === "amazon_music" && c.connected);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.mood || !form.food_type || !form.occasion) {
      setError("Please select a mood, food type, and occasion."); return;
    }
    setLoading(true); setError(null);
    try {
      const data = await api.createMusicMood(form);
      setResult(data);
      setHistory((h) => [data, ...h]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const display = result?.recommendations;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🎵 Music Mood</h1>
        <p className="text-gray-400 mt-1">Match your food and vibe to the perfect soundtrack</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Selector */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mood */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">How are you feeling?</label>
                <div className="grid grid-cols-2 gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, mood: m.value }))}
                      className={`p-3 rounded-xl border text-left transition-all ${form.mood === m.value ? "border-consumer-500 bg-consumer-50 shadow-sm" : "border-gray-200 hover:border-consumer-300"}`}
                    >
                      <div className="text-xl">{m.emoji}</div>
                      <div className="text-xs font-semibold text-gray-800 mt-1">{m.label}</div>
                      <div className="text-xs text-gray-400">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Food type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">What are you eating?</label>
                <div className="grid grid-cols-2 gap-2">
                  {FOOD_TYPES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setForm((fm) => ({ ...fm, food_type: f.value }))}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${form.food_type === f.value ? "border-consumer-500 bg-consumer-50" : "border-gray-200 hover:border-consumer-300"}`}
                    >
                      <span>{f.emoji}</span>
                      <span className="text-xs font-medium text-gray-700">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Occasion */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Occasion</label>
                <select
                  value={form.occasion}
                  onChange={(e) => setForm((f) => ({ ...f, occasion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
                >
                  <option value="">Choose occasion...</option>
                  {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-consumer-600 text-white font-semibold py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors"
              >
                {loading ? "Creating playlist..." : "Get My Soundtrack →"}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Result */}
        <div className="lg:col-span-3 space-y-4">
          {!display ? (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-consumer-100 flex flex-col items-center justify-center text-center h-80">
              <div className="text-6xl mb-4">🎵</div>
              <p className="text-gray-500 text-sm">Select your mood, food type, and occasion to get your personalised soundtrack.</p>
            </div>
          ) : (
            <>
              {/* Vibe card */}
              <div className={`rounded-2xl p-6 text-white bg-gradient-to-br from-consumer-500 to-consumer-800`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{display.emoji}</span>
                  <div>
                    <h2 className="text-2xl font-bold">{display.vibe}</h2>
                    <p className="text-consumer-200 text-sm">{display.bpm_range}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {display.genres.map((g) => (
                    <span key={g} className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">{g}</span>
                  ))}
                </div>
              </div>

              {/* Artists */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
                <h3 className="font-semibold text-gray-800 mb-3">🎤 Artists You'll Love</h3>
                <div className="flex flex-wrap gap-2">
                  {display.artists.map((a) => (
                    <span key={a} className="text-sm bg-consumer-50 text-consumer-700 px-3 py-1.5 rounded-full border border-consumer-200">{a}</span>
                  ))}
                </div>
              </div>

              {/* Play on services */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
                <h3 className="font-semibold text-gray-800 mb-4">▶ Play on your services</h3>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${connectedSpotify ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎧</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">Spotify</p>
                        <p className="text-xs text-gray-500">Search: "{display.spotify_query}"</p>
                      </div>
                    </div>
                    {connectedSpotify ? (
                      <a href={`https://open.spotify.com/search/${encodeURIComponent(display.spotify_query)}`} target="_blank" rel="noreferrer" className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-full font-medium">Play ↗</a>
                    ) : (
                      <a href="/consumer/social" className="text-xs bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full font-medium">Connect</a>
                    )}
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-xl border ${connectedAmazon ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔵</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">Amazon Music</p>
                        <p className="text-xs text-gray-500">Station: {display.amazon_station}</p>
                      </div>
                    </div>
                    {connectedAmazon ? (
                      <span className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-full font-medium">Playing</span>
                    ) : (
                      <a href="/consumer/social" className="text-xs bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full font-medium">Connect</a>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔵</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">Amazon Alexa</p>
                        <p className="text-xs text-gray-500 italic">"{display.alexa_command}"</p>
                      </div>
                    </div>
                    <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full">Say it</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-consumer-100">
              <h3 className="font-semibold text-gray-800 mb-3">Recent Moods</h3>
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setResult(m)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-consumer-50 border border-consumer-200 text-xs text-consumer-700 hover:bg-consumer-100 transition-colors"
                  >
                    <span>{m.recommendations?.emoji}</span>
                    <span className="capitalize">{m.mood}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
