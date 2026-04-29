import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

// Spotify is the only platform with a real OAuth flow today. The others stay
// as UI-only stubs because Amazon Music has no public OAuth, Alexa needs an
// Alexa Skill (different model), and Instagram/TikTok require Meta Business /
// TikTok app review before granting tokens — all out of scope for now.
const SPOTIFY_OAUTH = "spotify";

const PLATFORMS = [
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎧",
    color: "bg-green-500",
    description: "Get instant playlist generation based on your mood and food pairing.",
    real: true,
  },
  {
    id: "amazon_music",
    name: "Amazon Music",
    icon: "🎵",
    color: "bg-blue-500",
    description: "Play curated stations matched to your dining vibe on Amazon Music.",
    real: false,
    stubNote: "Amazon Music has no public OAuth API — connection is a label only.",
  },
  {
    id: "alexa",
    name: "Amazon Alexa",
    icon: "🔵",
    color: "bg-blue-400",
    description: "Control your dining music hands-free with voice commands via Alexa.",
    real: false,
    stubNote: "Voice control requires an Alexa Skill — connection is a label only.",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📷",
    color: "bg-pink-500",
    description: "Share your food & wine pairings directly to your Instagram stories.",
    real: false,
    stubNote: "Real posting requires Meta Business approval — connection is a label only.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎬",
    color: "bg-gray-900",
    description: "Post your wine pairing discoveries and music moods to TikTok.",
    real: false,
    stubNote: "Real posting requires TikTok app review — connection is a label only.",
  },
];

export default function SocialConnect() {
  const router = useRouter();
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [banner, setBanner] = useState(null);
  const [spotifyBusy, setSpotifyBusy] = useState(false);

  const reloadConnections = () =>
    api.getConnections().then((data) => {
      const map = {};
      data.forEach((c) => { map[c.platform] = c; });
      setConnections(map);
    });

  useEffect(() => {
    reloadConnections().finally(() => setLoading(false));
  }, []);

  // Surface the Spotify OAuth result. The backend redirects back here with
  // ?spotify=connected (or ?spotify=error&reason=...) after the round-trip.
  useEffect(() => {
    if (!router.isReady) return;
    const { spotify, reason } = router.query;
    if (!spotify) return;

    if (spotify === "connected") {
      setBanner({ kind: "success", text: "✓ Spotify connected." });
      reloadConnections();
    } else if (spotify === "error") {
      const msg =
        reason === "access_denied" ? "You declined to grant Spotify access."
        : reason === "bad_state"   ? "Authorization session expired — please try again."
        : reason === "token_exchange_failed" ? "Spotify rejected the authorization. Please retry."
        : "Spotify connection failed. Please try again.";
      setBanner({ kind: "error", text: msg });
    }
    // Strip query so a refresh doesn't re-show the banner
    router.replace("/consumer/social", undefined, { shallow: true });
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectSpotify = async () => {
    setSaveError(null);
    setSpotifyBusy(true);
    try {
      const { authorize_url } = await api.startSpotifyAuth();
      window.location.href = authorize_url;
    } catch (err) {
      setSpotifyBusy(false);
      // 503 = server didn't have CLIENT_ID configured. Surface a clear msg.
      if ((err.message || "").includes("not configured")) {
        setSaveError("Spotify integration is not configured on this server. Ask the admin to set SPOTIFY_CLIENT_ID/SECRET.");
      } else {
        setSaveError(err.message || "Failed to start Spotify authorization.");
      }
    }
  };

  const handleDisconnectSpotify = () => {
    setConfirmDialog({
      message: "Disconnect your Spotify account?",
      confirmLabel: "Disconnect",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.disconnectSpotify();
          await reloadConnections();
        } catch (err) {
          setSaveError(err.message || "Failed to disconnect.");
        }
      },
    });
  };

  // Stub flow for non-OAuth platforms — same as before, just with a clearer
  // label so users aren't tricked into thinking they actually connected.
  const handleStubConnect = (platform) => {
    setEditing(platform);
    setUsernameInput(connections[platform]?.username || "");
  };

  const handleStubSave = async (platform) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateConnection(platform, {
        platform,
        connected: true,
        username: usernameInput || null,
      });
      setConnections((prev) => ({ ...prev, [platform]: updated }));
      setEditing(null);
    } catch (err) {
      setSaveError(err.message || "Failed to save connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleStubDisconnect = (platform) => {
    setConfirmDialog({
      message: `Disconnect ${platform}?`,
      confirmLabel: "Disconnect",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const updated = await api.updateConnection(platform, { platform, connected: false, username: null });
          setConnections((prev) => ({ ...prev, [platform]: updated }));
        } catch (err) {
          setSaveError(err.message || "Failed to disconnect.");
          setEditing(platform);
        }
      },
    });
  };

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading connections...</div>;

  const connectedCount = Object.values(connections).filter((c) => c.connected).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🔗 Connect Your Services</h1>
        <p className="text-gray-400 mt-1">Link music and social platforms for the full SavoryMind experience</p>
      </div>

      {banner && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${
          banner.kind === "success"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {banner.text}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <div className="bg-consumer-50 border border-consumer-200 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-consumer-600 font-bold text-lg">{connectedCount}</span>
          <span className="text-sm text-consumer-700">of {PLATFORMS.length} services connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => {
          const conn = connections[p.id];
          const isConnected = conn?.connected;
          const isEditing = editing === p.id;
          const isSpotify = p.id === SPOTIFY_OAUTH;

          return (
            <div key={p.id} className={`bg-white rounded-2xl p-6 shadow-sm border ${isConnected ? "border-consumer-200" : "border-gray-200"} transition-colors`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${p.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      {p.name}
                      {p.real ? (
                        <span className="text-[10px] uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">Real OAuth</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Demo</span>
                      )}
                    </h3>
                    {isConnected && (
                      <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        ✓ Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.description}</p>

                  {isConnected && conn.username && (
                    <p className="text-xs text-consumer-600 mt-2 font-medium">
                      {isSpotify ? "Connected as " : "@"}{conn.username}
                    </p>
                  )}

                  {/* Real OAuth path (Spotify) */}
                  {isSpotify ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isConnected ? (
                        <>
                          {conn.profile_url && (
                            <a
                              href={conn.profile_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100"
                            >
                              View profile ↗
                            </a>
                          )}
                          <button
                            onClick={handleConnectSpotify}
                            disabled={spotifyBusy}
                            className="text-xs bg-consumer-50 text-consumer-700 border border-consumer-200 px-3 py-1.5 rounded-lg hover:bg-consumer-100 disabled:opacity-60"
                          >
                            Reconnect
                          </button>
                          <button
                            onClick={handleDisconnectSpotify}
                            className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleConnectSpotify}
                          disabled={spotifyBusy}
                          className="text-xs bg-green-500 text-white px-4 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-60 font-medium"
                        >
                          {spotifyBusy ? "Redirecting…" : "Connect Spotify"}
                        </button>
                      )}
                      {saveError && (
                        <div className="basis-full text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
                          {saveError}
                        </div>
                      )}
                    </div>
                  ) : isEditing ? (
                    /* Stub flow for non-OAuth platforms */
                    <div className="mt-3 space-y-2">
                      <input
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder={`Your ${p.name} username (optional)`}
                        className="w-full border border-consumer-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
                      />
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <strong>Demo only.</strong> {p.stubNote}
                      </div>
                      {saveError && editing === p.id && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          {saveError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStubSave(p.id)}
                          disabled={saving}
                          className="text-xs bg-consumer-600 text-white px-4 py-1.5 rounded-lg hover:bg-consumer-700 disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Save label"}
                        </button>
                        <button
                          onClick={() => { setEditing(null); setSaveError(null); }}
                          className="text-xs bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => handleStubConnect(p.id)}
                            className="text-xs bg-consumer-50 text-consumer-700 border border-consumer-200 px-3 py-1.5 rounded-lg hover:bg-consumer-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleStubDisconnect(p.id)}
                            className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStubConnect(p.id)}
                          className="text-xs bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg hover:bg-gray-300"
                        >
                          Add label
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-consumer-50 border border-consumer-200 rounded-2xl p-5 text-sm text-consumer-800">
        <p className="font-semibold mb-1">🔒 Your privacy is protected</p>
        <p className="text-consumer-600 leading-relaxed">
          Spotify uses real OAuth — your password never touches our servers, and you can revoke access at any time
          from your Spotify account page. The other services are currently labels only because their public APIs
          require enterprise approval.
        </p>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
