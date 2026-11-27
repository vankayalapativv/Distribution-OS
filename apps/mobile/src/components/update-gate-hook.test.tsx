import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type UpdatesState = {
  isDownloading: boolean;
  isUpdatePending: boolean;
  isUpdateAvailable: boolean;
  downloadProgress: number | null;
  availableUpdate?: { manifest: unknown };
  downloadedUpdate?: { manifest: unknown };
};

const up = vi.hoisted(() => ({
  state: {
    isDownloading: false,
    isUpdatePending: false,
    isUpdateAvailable: false,
    downloadProgress: 0,
    availableUpdate: undefined,
    downloadedUpdate: undefined,
  } as UpdatesState,
  isEnabled: true,
  reloadAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock("expo-updates", () => ({
  useUpdates: () => up.state,
  get isEnabled() {
    return up.isEnabled;
  },
  reloadAsync: () => up.reloadAsync(),
}));
vi.mock("../lib/update-release-info", () => ({
  readUpdateReleaseInfo: (m: unknown) => (m ? { version: "9.9.9", notes: ["Note A"] } : { version: null, notes: [] }),
}));

import { useOtaUpdate } from "./update-gate-hook";

const dev = (v: boolean) => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = v;
};

beforeEach(() => {
  up.state = {
    isDownloading: false,
    isUpdatePending: false,
    isUpdateAvailable: false,
    downloadProgress: 0,
    availableUpdate: undefined,
    downloadedUpdate: undefined,
  };
  up.isEnabled = true;
  up.reloadAsync.mockReset().mockResolvedValue(undefined as never);
});
afterEach(() => dev(true)); // restore setup-dom's default

describe("useOtaUpdate", () => {
  it("stays idle (and never reloads) in dev, even with a pending update", () => {
    dev(true);
    up.state = { ...up.state, isUpdatePending: true };
    const { result } = renderHook(() => useOtaUpdate());
    expect(result.current.installing).toBe(false);
    expect(result.current.downloading).toBe(false);
    expect(up.reloadAsync).not.toHaveBeenCalled();
  });

  it("enters the installing phase and applies the pending bundle", () => {
    dev(false);
    up.state = { ...up.state, isUpdatePending: true, downloadedUpdate: { manifest: {} } };
    const { result } = renderHook(() => useOtaUpdate());
    expect(result.current.installing).toBe(true);
    expect(result.current.version).toBe("9.9.9");
    expect(up.reloadAsync).toHaveBeenCalled();
  });

  it("hides the overlay when the reload fails", async () => {
    dev(false);
    up.reloadAsync.mockRejectedValue(new Error("reload failed"));
    up.state = { ...up.state, isUpdatePending: true };
    const { result } = renderHook(() => useOtaUpdate());
    await waitFor(() => expect(result.current.installing).toBe(false));
  });

  it("reports the download phase with a clamped percent + manifest notes", () => {
    dev(false);
    up.state = {
      ...up.state,
      isDownloading: true,
      isUpdateAvailable: true,
      downloadProgress: 0.37,
      availableUpdate: { manifest: {} },
    };
    const { result } = renderHook(() => useOtaUpdate());
    expect(result.current.downloading).toBe(true);
    expect(result.current.pct).toBe(37);
    expect(result.current.notes).toEqual(["Note A"]);
  });

  it("clamps the percent for out-of-range / missing progress", () => {
    dev(false);
    up.state = { ...up.state, downloadProgress: 1.5 };
    expect(renderHook(() => useOtaUpdate()).result.current.pct).toBe(100);
    up.state = { ...up.state, downloadProgress: null };
    expect(renderHook(() => useOtaUpdate()).result.current.pct).toBe(0);
  });

  it("stops showing the download once the stall timeout fires", () => {
    vi.useFakeTimers();
    dev(false);
    up.state = { ...up.state, isDownloading: true, isUpdateAvailable: true };
    const { result, rerender } = renderHook(() => useOtaUpdate());
    expect(result.current.downloading).toBe(true);
    act(() => vi.advanceTimersByTime(20_000)); // stall timeout
    rerender();
    expect(result.current.downloading).toBe(false);
    vi.useRealTimers();
  });
});
