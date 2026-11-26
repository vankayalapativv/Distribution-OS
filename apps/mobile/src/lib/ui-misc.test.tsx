import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePlaceholderColor } from "./theme";
import { useBottomInset } from "./use-bottom-inset";

const useColorScheme = vi.fn<() => string>(() => "light");
const useSafeAreaInsets = vi.fn(() => ({ top: 0, bottom: 24, left: 0, right: 0 }));
vi.mock("react-native", () => ({ useColorScheme: () => useColorScheme() }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => useSafeAreaInsets() }));


afterEach(() => vi.clearAllMocks());

describe("usePlaceholderColor", () => {
  it("adapts to the colour scheme", () => {
    useColorScheme.mockReturnValue("light");
    expect(renderHook(() => usePlaceholderColor()).result.current).toBe("#6b7280");
    useColorScheme.mockReturnValue("dark");
    expect(renderHook(() => usePlaceholderColor()).result.current).toBe("#a3a3a3");
  });
});

describe("useBottomInset", () => {
  it("adds the safe-area bottom inset to the base padding", () => {
    expect(renderHook(() => useBottomInset()).result.current).toBe(36); // 24 + 12 default
    expect(renderHook(() => useBottomInset(8)).result.current).toBe(32); // 24 + 8
  });
});

describe("queryClient", () => {
  it("is a configured singleton", async () => {
    const { queryClient } = await import("./query-client");
    expect(queryClient.getDefaultOptions().queries).toMatchObject({ retry: 1, staleTime: 60_000 });
  });
});
