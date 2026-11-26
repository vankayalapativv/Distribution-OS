import { afterEach, describe, expect, it, vi } from "vitest";
import {
  notifyAuthExpired,
  notifyTokenRefreshed,
  setAuthEventHandlers,
} from "./auth-events";

afterEach(() => {
  vi.useRealTimers();
  // Reset the registered handlers to no-ops between tests.
  setAuthEventHandlers({ onRefresh: () => {}, onExpired: () => {} });
});

describe("setAuthEventHandlers / notifyTokenRefreshed", () => {
  it("routes a refreshed token to the registered handler", () => {
    const onRefresh = vi.fn();
    setAuthEventHandlers({ onRefresh });
    notifyTokenRefreshed("new-token");
    expect(onRefresh).toHaveBeenCalledWith("new-token");
  });

  it("only overwrites the handlers that are provided", () => {
    const onRefresh = vi.fn();
    const onExpired = vi.fn();
    setAuthEventHandlers({ onRefresh, onExpired });
    setAuthEventHandlers({}); // neither branch taken → handlers unchanged
    notifyTokenRefreshed("t");
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

describe("notifyAuthExpired (debounced)", () => {
  it("fires once, then suppresses a burst within 3s, then fires again after", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000); // past the initial lastExpiredAt=0 window
    const onExpired = vi.fn();
    setAuthEventHandlers({ onExpired });

    notifyAuthExpired();
    notifyAuthExpired(); // within 3s → suppressed
    expect(onExpired).toHaveBeenCalledOnce();

    vi.setSystemTime(13_001);
    notifyAuthExpired();
    expect(onExpired).toHaveBeenCalledTimes(2);
  });
});
