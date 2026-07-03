import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

export default function Integrations() {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    api.getPosStatus().then(setStatus).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Surface the ?pos=connected|error the OAuth callback redirects back with.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.pos === "connected") { setFlash({ ok: true, msg: t("integrationsPage.connected") }); load(); }
    else if (router.query.pos === "error") setFlash({ ok: false, msg: t("integrationsPage.connectError") });
  }, [router.isReady, router.query.pos]); // eslint-disable-line

  const connect = async () => {
    setBusy(true);
    try {
      const { authorize_url } = await api.startSquareConnect();
      window.location.href = authorize_url;
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const sync = async () => {
    setBusy(true); setFlash(null);
    try {
      const stats = await api.syncPos();
      setFlash({ ok: true, msg: t("integrationsPage.syncDone", { items: stats.items, orders: stats.orders }) });
      load();
    } catch (e) { setFlash({ ok: false, msg: e.message }); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await api.disconnectPos(); load(); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("integrationsPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("integrationsPage.subtitle")}</p>
      </div>

      {flash && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${flash.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {flash.msg}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center text-2xl">◼</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900">{t("integrationsPage.square")}</h2>
            <p className="text-sm text-gray-500">{t("integrationsPage.squareDesc")}</p>
          </div>
          {status.connected ? (
            <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">{t("integrationsPage.statusConnected")}</span>
          ) : (
            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{t("integrationsPage.statusOff")}</span>
          )}
        </div>

        {!status.configured && (
          <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">{t("integrationsPage.notConfigured")}</p>
        )}

        {status.connected && (
          <div className="mt-4 text-sm text-gray-600 space-y-1">
            {status.merchant_name && <p><span className="text-gray-400">{t("integrationsPage.merchant")}:</span> {status.merchant_name}</p>}
            {status.last_synced_at && <p><span className="text-gray-400">{t("integrationsPage.lastSync")}:</span> {new Date(status.last_synced_at).toLocaleString()}</p>}
            {status.last_sync_stats && (
              <p className="text-xs text-gray-500">
                {t("integrationsPage.syncSummary", { items: status.last_sync_stats.items, orders: status.last_sync_stats.orders, revenue: status.last_sync_stats.revenue })}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!status.connected ? (
            <button onClick={connect} disabled={busy || !status.configured}
              className="bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50">
              {t("integrationsPage.connectSquare")}
            </button>
          ) : (
            <>
              <button onClick={sync} disabled={busy}
                className="bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {busy ? t("integrationsPage.syncing") : t("integrationsPage.syncNow")}
              </button>
              <button onClick={disconnect} disabled={busy}
                className="border border-gray-200 text-gray-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50">
                {t("integrationsPage.disconnect")}
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-gray-400">{t("integrationsPage.whatItDoes")}</p>
      </div>
    </div>
  );
}
