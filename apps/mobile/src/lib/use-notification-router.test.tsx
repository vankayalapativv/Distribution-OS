import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNotificationRouter } from "./use-notification-router";

const push = vi.fn();
const remove = vi.fn();
let handler: (r: unknown) => void = () => undefined;
const addListener = vi.fn((cb: (r: unknown) => void) => { handler = cb; return { remove }; });
vi.mock("expo-router", () => ({ useRouter: () => ({ push: (...a: unknown[]) => push(...a) }) }));
vi.mock("expo-notifications", () => ({ addNotificationResponseReceivedListener: (cb: (r: unknown) => void) => addListener(cb) }));

const fire = (data: unknown) => handler({ notification: { request: { content: { data } } } });
afterEach(() => vi.clearAllMocks());

describe("useNotificationRouter", () => {
  it("opens the linked customer for a reminder tap", () => {
    renderHook(() => useNotificationRouter());
    fire({ kind: "reminder", customerId: "c1" });
    expect(push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c1" } });
  });
  it("opens Reminders for an assigned-task push (either shape)", () => {
    renderHook(() => useNotificationRouter());
    fire({ kind: "assigned_task" });
    fire({ type: "task_assigned" });
    expect(push).toHaveBeenCalledWith("/reminders");
    expect(push).toHaveBeenCalledTimes(2);
  });
  it("opens Alerts for an invoice push", () => {
    renderHook(() => useNotificationRouter());
    fire({ type: "invoice" });
    expect(push).toHaveBeenCalledWith("/alerts");
  });
  it("does nothing for a reminder with no customer, or an unknown payload", () => {
    renderHook(() => useNotificationRouter());
    fire({ kind: "reminder" });
    fire({ kind: "mystery" });
    expect(push).not.toHaveBeenCalled();
  });
  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useNotificationRouter());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
