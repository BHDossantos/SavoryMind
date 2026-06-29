import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";

// Spotify is the only platform with a real OAuth integration. The previous
// stubs (Amazon Music, Alexa, Instagram, TikTok) were removed because none
// has a viable public OAuth path without enterprise approval — keeping them
// as labels-only was actively misleading users.

export default function SocialConnect() {
  const router = useRouter();
  const { t } = useTranslation();
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [banner, setBanner] = useState(null);
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [error, setError] = useState(null);

  const reloadConnections = () =>
    api.getConnections().then((data) => {
      const map = {};
      data.forEach((c) => { map[c.platform] = c; });
      setConnections(map);
    });

  useEffect(() => {
    reloadConnections().finally(() => setLoading(false));
  }, []);

  // Surface the Spotify OAuth result. Backend redirects back here with
  // ?spotify=connected (or ?spotify=error&reason=...) after the round-trip.
  useEffect(() => {
    if (!router.isReady) return;
    const { spotify, reason } = router.query;
    if (!spotify) return;

    if (spotify === "connected") {
      setBanner({ kind: "success", text: t("socialPage.bannerSuccess") });
      reloadConnections();
    } else if (spotify === "error") {
      const msg =
        reason === "access_denied" ? t("socialPage.bannerDenied")
        : reason === "bad_state"   ? t("socialPage.bannerBadState")
        : reason === "token_exchange_failed" ? t("socialPage.bannerTokenFailed")
        : t("socialPage.bannerGeneric");
      setBanner({ kind: "error", text: msg });
    }
    router.replace("/consumer/social", undefined, { shallow: true });
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectSpotify = async () => {
    setError(null);
    setSpotifyBusy(true);
    try {
      const { authorize_url } = await api.startSpotifyAuth();
      window.location.href = authorize_url;
    } catch (err) {
      setSpotifyBusy(false);
      if ((err.message || "").includes("not configured")) {
        setError(t("socialPage.errNotConfigured"));
      } else {
        setError(err.message || t("socialPage.errFailedStart"));
      }
    }
  };

  const handleDisconnectSpotify = () => {
    setConfirmDialog({
      message: t("socialPage.disconnectPrompt"),
      confirmLabel: t("socialPage.disconnectBtn"),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.disconnectSpotify();
          await reloadConnections();
        } catch (err) {
          setError(err.message || t("socialPage.errFailedDisconnect"));
        }
      },
    });
  };

  if (loading) return <div className="text-gray-400 text-sm p-8">{t("socialPage.loading")}</div>;

  const conn = connections.spotify;
  const isConnected = conn?.connected;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("socialPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("socialPage.subtitle")}</p>
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

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
            🎧
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{t("socialPage.spotifyTitle")}</h3>
              {isConnected && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  {t("socialPage.connected")}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {t("socialPage.spotifyDescPrefix")}{" "}
              <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noreferrer" className="underline">spotify.com/account/apps</a>{t("socialPage.spotifyDescSuffix")}
            </p>

            {isConnected && conn.username && (
              <p className="text-sm text-green-700 mt-2 font-medium">
                {t("socialPage.connectedAs", { username: conn.username })}
              </p>
            )}

            {/* Reconnect nudge — when a connection predates the
                user-top-read scope upgrade, the recommendation engine
                gets no listening signal from this user. The Spotify
                connect / disconnect / search calls all still work
                with the older scope, so we don't force a reconnect;
                we just surface the upgrade benefit. */}
            {isConnected && conn.scopes !== undefined && conn.scopes !== null
                && !conn.scopes.split(/\s+/).includes('user-top-read') && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <span className="font-semibold">{t("socialPage.reconnectNudgePrefix")}</span>{" "}
                {t("socialPage.reconnectNudgeSuffix")}
              </div>
            )}

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
                      {t("socialPage.viewProfile")}
                    </a>
                  )}
                  <button
                    onClick={handleConnectSpotify}
                    disabled={spotifyBusy}
                    className="text-xs bg-consumer-50 text-consumer-700 border border-consumer-200 px-3 py-1.5 rounded-lg hover:bg-consumer-100 disabled:opacity-60"
                  >
                    {t("socialPage.reconnect")}
                  </button>
                  <button
                    onClick={handleDisconnectSpotify}
                    className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                  >
                    {t("socialPage.disconnect")}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectSpotify}
                  disabled={spotifyBusy}
                  className="text-xs bg-green-500 text-white px-4 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-60 font-medium"
                >
                  {spotifyBusy ? t("socialPage.redirecting") : t("socialPage.connectSpotify")}
                </button>
              )}
            </div>

            {error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </div>
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
