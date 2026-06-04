/**
 * usePolling hook tests.
 *
 * Pins down the contract the booking pages rely on:
 *   - fires the fetcher every intervalMs while enabled and tab is visible
 *   - does not fire when enabled=false
 *   - pauses while document.visibilityState !== "visible" and resumes on
 *     the visibilitychange event
 *   - swallows fetcher errors so a transient network blip doesn't stop polling
 *   - cleans up on unmount
 */
import React from "react";
import { render, act } from "@testing-library/react";
import usePolling from "../../hooks/usePolling";

// Helper component so we can mount/unmount the hook without standing up a
// full page.
function Probe({ fetcher, intervalMs, enabled }) {
  usePolling(fetcher, { intervalMs, enabled });
  return null;
}

function setVisibility(state) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("usePolling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("calls the fetcher every intervalMs while enabled", () => {
    const fetcher = jest.fn().mockResolvedValue(undefined);
    render(<Probe fetcher={fetcher} intervalMs={1000} enabled={true} />);

    expect(fetcher).not.toHaveBeenCalled(); // no leading edge — first call is after interval

    act(() => { jest.advanceTimersByTime(1000); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Each tick is scheduled after the previous fetcher resolves; flush the
    // resolved promise before advancing again.
    return Promise.resolve().then(() => {
      act(() => { jest.advanceTimersByTime(1000); });
      return Promise.resolve();
    }).then(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  test("does not fire when enabled=false", () => {
    const fetcher = jest.fn();
    render(<Probe fetcher={fetcher} intervalMs={1000} enabled={false} />);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("pauses while the tab is hidden", async () => {
    const fetcher = jest.fn().mockResolvedValue(undefined);
    render(<Probe fetcher={fetcher} intervalMs={1000} enabled={true} />);

    setVisibility("hidden");
    act(() => { jest.advanceTimersByTime(5000); });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("resumes on visibilitychange to visible", async () => {
    const fetcher = jest.fn().mockResolvedValue(undefined);
    setVisibility("hidden");
    render(<Probe fetcher={fetcher} intervalMs={1000} enabled={true} />);

    act(() => { jest.advanceTimersByTime(2000); });
    expect(fetcher).not.toHaveBeenCalled();

    setVisibility("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    // Visibility handler fires the tick immediately when becoming visible.
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("swallows fetcher errors so polling continues", async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValue(undefined);
    render(<Probe fetcher={fetcher} intervalMs={1000} enabled={true} />);

    act(() => { jest.advanceTimersByTime(1000); });
    // Let the rejected promise settle before advancing again.
    await Promise.resolve();
    await Promise.resolve();
    act(() => { jest.advanceTimersByTime(1000); });
    await Promise.resolve();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("stops on unmount", () => {
    const fetcher = jest.fn().mockResolvedValue(undefined);
    const { unmount } = render(<Probe fetcher={fetcher} intervalMs={1000} enabled={true} />);
    unmount();
    act(() => { jest.advanceTimersByTime(10000); });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
