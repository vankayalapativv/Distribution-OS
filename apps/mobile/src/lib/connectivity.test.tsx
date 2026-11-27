import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// setup-dom globally stubs this module for component tests; here we exercise the
// real implementation, so opt out of that global mock.
vi.unmock("./connectivity");

let networkListener: (s: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void = () => {};
vi.mock("expo-network", () => ({
  getNetworkStateAsync: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: (cb: typeof networkListener) => { networkListener = cb; },
}));

import { useIsOnline } from "./connectivity";

afterEach(() => vi.clearAllMocks());

describe("useIsOnline", () => {
  it("re-renders when connectivity flips", () => {
    const { result } = renderHook(() => useIsOnline());
    expect(result.current).toBe(true); // optimistic default
    act(() => networkListener({ isConnected: false, isInternetReachable: false }));
    expect(result.current).toBe(false);
    act(() => networkListener({ isConnected: true, isInternetReachable: true }));
    expect(result.current).toBe(true);
  });
});
