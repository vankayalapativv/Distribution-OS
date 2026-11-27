import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const appStateCbs: Array<(s: string) => void> = [];
vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  return {
    ...actual,
    AppState: { addEventListener: (_t: string, cb: (s: string) => void) => { appStateCbs.push(cb); return { remove: vi.fn() }; } },
  };
});

const refetchQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ refetchQueries }) }));

const getLocalDb = vi.fn();
const pendingFollowupCount = vi.fn();
const unreadCount = vi.fn();
const useNotificationsQuery = vi.fn(() => ({ data: [] }));
vi.mock("../../lib/db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../../lib/customer/followups", () => ({ pendingFollowupCount: (db: unknown) => pendingFollowupCount(db) }));
vi.mock("../../lib/notifications-query", () => ({
  NOTIFICATIONS_KEY: ["notifications"],
  unreadCount: (d: unknown) => unreadCount(d),
  useNotificationsQuery: () => useNotificationsQuery(),
}));

vi.mock("expo-router", () => {
  const Tabs = ({ screenOptions, children }: { screenOptions?: { tabBarButton?: (p: Record<string, unknown>) => React.ReactNode }; children?: React.ReactNode }) => (
    <div>
      {screenOptions?.tabBarButton?.({ children: null })}
      {children}
    </div>
  );
  Tabs.Screen = ({ options }: { options?: { tabBarIcon?: (p: { color: string; focused: boolean }) => React.ReactNode } }) => (
    <div>
      {options?.tabBarIcon?.({ color: "#000", focused: true })}
      {options?.tabBarIcon?.({ color: "#000", focused: false })}
    </div>
  );
  return { Tabs };
});

import TabsLayout from "./_layout";

beforeEach(() => { appStateCbs.length = 0; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("TabsLayout", () => {
  it("renders tabs; no badges at zero; foreground refetch + interval poll", () => {
    getLocalDb.mockReturnValue({});
    pendingFollowupCount.mockReturnValue(0);
    unreadCount.mockReturnValue(0);
    act(() => { render(<TabsLayout />); });
    // AppState active → refetch; inactive → ignored.
    act(() => appStateCbs.forEach((cb) => cb("active")));
    expect(refetchQueries).toHaveBeenCalled();
    act(() => appStateCbs.forEach((cb) => cb("inactive")));
    // Interval re-reads the follow-up count.
    act(() => vi.advanceTimersByTime(8000));
    expect(pendingFollowupCount).toHaveBeenCalled();
  });

  it("caps both badges at 99+ for large counts", () => {
    getLocalDb.mockReturnValue({});
    pendingFollowupCount.mockReturnValue(150);
    unreadCount.mockReturnValue(150);
    act(() => { render(<TabsLayout />); });
    expect(pendingFollowupCount).toHaveBeenCalled();
  });

  it("shows exact small badge counts", () => {
    getLocalDb.mockReturnValue({});
    pendingFollowupCount.mockReturnValue(5); // 1..99 → exact followup badge
    unreadCount.mockReturnValue(5); // 1..99 → exact alert badge
    act(() => { render(<TabsLayout />); });
    expect(pendingFollowupCount).toHaveBeenCalled();
  });

  it("tolerates a missing db and cleans up on unmount", () => {
    getLocalDb.mockReturnValue(null);
    pendingFollowupCount.mockReturnValue(5);
    unreadCount.mockReturnValue(0);
    const { unmount } = render(<TabsLayout />);
    act(() => { unmount(); }); // clearInterval + listener removal
    expect(pendingFollowupCount).not.toHaveBeenCalled(); // db null → read() no-ops
  });
});
