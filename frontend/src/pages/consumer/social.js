import { useState, useEffect } from "react";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

const PLATFORMS = [
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎧",
    color: "bg-green-500",
    description: "Get instant playlist generation based on your mood and food pairing.",
    connectNote: "Redirect to Spotify OAuth — requires Spotify Developer app credentials.",
  },
  {
    id: "amazon_music",
    name: "Amazon Music",
    icon: "🎵",
    color: "bg-blue-500",
    description: "Play curated stations matched to your dining vibe on Amazon Music.",
    connectNote: "Redirect to Amazon OAuth — requires Amazon Developer app credentials.",
  },
  {
    id: "alexa",
    name: "Amazon Alexa",
    icon: "🔵",
    color: "bg-blue-400",
    description: "Control your dining music hands-free with voice commands via Alexa.",
    connectNote: "Links your Alexa account for voice-activated music during meals.",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📷",
    color: "bg-pink-500",
    description: "Share your food & wine pairings directly to your Instagram stories.",
    connectNote: "Connect your Instagram to share pairings with followers.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎬",
    color: "bg-gray-900",
    description: "Post your wine pairing discoveries and music moods to TikTok.",
    connectNote: "Connect TikTok to share your food journey.",
  },
];

export default function SocialConnect() {
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmDlg, setConfirmDlg] = useState(null);

  useEffect(() => {
    api.getConnections()
      .then((data) => {
        const map = {};
        data.forEach((c) => { map[c.platform] = c; });
        setConnections(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (platform) => {
    setEditing(platform);
    setUsernameInput(connections[platform]?.username || "");
  };

  const handleSave = async (platform) => {
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

  const handleDisconnect = (platform) => {
    setConfirmDlg({
      message: `Disconnect ${platform}?`,
      onConfirm: async () => {
        setConfirmDlg(null);
        try {
          const updated = await api.updateConnection(platform, { platform, connected: false, username: null });
          setConnections((prev) => ({ ...prev, [platform]: updated }));
        } catch (err) { setSaveError(err.message || "Failed to disconnect."); }
      },
    });
  };

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading connections...</div>;

  const connectedCount = Object.values(connections).filter((c) => c.connected).length;

  return (
    <div>
      {confirmDlg && <ConfirmDialog message={confirmDlg.message} onConfirm={confirmDlg.onConfirm} onCancel={() => setConfirmDlg(null)} />}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🔗 Connect Your Services</h1>
        <p className="text-gray-400 mt-1">Link music and social platforms for the full SavoryMind experience</p>
      </div>

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

          return (
            <div key={p.id} className={`bg-white rounded-2xl p-6 shadow-sm border ${isConnected ? "border-consumer-200" : "border-gray-200"} transition-colors`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${p.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    {isConnected && (
                      <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        ✓ Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.description}</p>

                  {isConnected && conn.username && (
                    <p className="text-xs text-consumer-600 mt-2 font-medium">@{conn.username}</p>
                  )}

                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <input
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder={`Your ${p.name} username (optional)`}
                        className="w-full border border-consumer-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
                      />
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <strong>Note:</strong> {p.connectNote}
                      </div>
                      {saveError && editing === p.id && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          {saveError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(p.id)}
                          disabled={saving}
                          className="text-xs bg-consumer-600 text-white px-4 py-1.5 rounded-lg hover:bg-consumer-700 disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Mark as Connected"}
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
                            onClick={() => handleConnect(p.id)}
                            className="text-xs bg-consumer-50 text-consumer-700 border border-consumer-200 px-3 py-1.5 rounded-lg hover:bg-consumer-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDisconnect(p.id)}
                            className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleConnect(p.id)}
                          className="text-xs bg-consumer-600 text-white px-4 py-1.5 rounded-lg hover:bg-consumer-700"
                        >
                          Connect {p.name}
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
          SavoryMind stores only your display name and username per service. In a production deployment,
          actual OAuth tokens are encrypted and never shared. Music playback links open in the respective apps.
        </p>
      </div>
    </div>
  );
}
