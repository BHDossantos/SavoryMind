import { useEffect, useRef } from "react";

/**
 * Visibility-aware short polling. Calls `fetcher` every `intervalMs` while the
 * tab is visible and `enabled` is true. Pauses (without firing) when the tab is
 * hidden and resumes on visibility change — keeps battery and quota costs sane
 * while still feeling real-time when the user is actually looking.
 *
 * Errors from `fetcher` are swallowed: the next tick retries. The fetcher is
 * captured by ref so callers don't have to memoise it.
 */
export default function usePolling(fetcher, { intervalMs = 5000, enabled = true } = {}) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try { await fetcherRef.current(); } catch { /* next tick retries */ }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    timer = setTimeout(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs]);
}
