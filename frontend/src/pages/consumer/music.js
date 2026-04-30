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
  // Real Spotify tracks fetched via the user's connection. Null = not yet
  // attempted; [] = attempted and got nothing back; populated = render them.
  const [spotifyTracks, setSpotifyTracks]       = useState(null);
  const [spotifyLoading, setSpotifyLoading]     = useState(false);
  const [spotifyAuthError, setSpotifyAuthError] = useState(false);

  useEffect(() => {
    api.getMusicMoods().then(setHistory).catch(() => {});
    api.getConnections().then(setConnections).catch(() => {});
  }, []);

  const connectedSpotify = connections.find((c) => c.platform === "spotify" && c.connected);

  // Whenever the rendered result changes and we're connected to Spotify, fetch
  // real tracks matching the recommended search query so the user can play
  // them instead of staring at a static "Search: ..." line.
  useEffect(() => {
    const display = result?.recommendations;
    if (!display?.spotify_query || !connectedSpotify) {
      setSpotifyTracks(null);
      setSpotifyAuthError(false);
      return;
    }
    let cancelled = false;
    setSpotifyLoading(true);
    setSpotifyAuthError(false);
    api.searchSpotify(display.spotify_query, 12)
      .then((data) => {
        if (cancelled) return;
        setSpotifyTracks(data.tracks || []);
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 = stored token expired and no refresh worked → user must reconnect.
        // 409 = backend says not connected (race with disconnect elsewhere).
        // 502 = Spotify-side outage. We surface the first two to the UI; for 502
        // we just hide the section to avoid noise.
        const msg = err.message || "";
        if (msg.includes("Spotify session expired") || msg.includes("not connected") || msg.includes("rejected")) {
          setSpotifyAuthError(true);
        }
        setSpotifyTracks([]);
      })
      .finally(() => { if (!cancelled) setSpotifyLoading(false); });
    return () => { cancelled = true; };
  }, [result?.id, connectedSpotify]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  <div className={`p-4 rounded-xl border ${connectedSpotify ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-center justify-between">
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

                    {/* Real Spotify tracks — only when connected and the search resolved */}
                    {connectedSpotify && (
                      <div className="mt-3 pt-3 border-t border-green-100">
                        {spotifyAuthError ? (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Your Spotify session expired. <a href="/consumer/social" className="underline font-medium">Reconnect</a> to see real tracks.
                          </div>
                        ) : spotifyLoading ? (
                          <p className="text-xs text-gray-500">Finding tracks on your Spotify…</p>
                        ) : spotifyTracks && spotifyTracks.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Top matches on your Spotify</p>
                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                              {spotifyTracks.map((t) => (
                                <a
                                  key={t.id}
                                  href={t.external_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                  {t.album_image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={t.album_image} alt="" className="w-10 h-10 rounded shadow-sm flex-shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-gray-200 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-gray-800 truncate">{t.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{(t.artists || []).join(", ")}</p>
                                  </div>
                                  <span className="text-xs text-green-700 flex-shrink-0">Open ↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : spotifyTracks && spotifyTracks.length === 0 ? (
                          <p className="text-xs text-gray-500">No tracks matched on your Spotify. Use the Play link above to search instead.</p>
                        ) : null}
                      </div>
                    )}
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
