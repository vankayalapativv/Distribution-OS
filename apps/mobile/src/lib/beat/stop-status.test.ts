import { afterEach, describe, expect, it, vi } from "vitest";
import { effectiveStopStatus, isStopDone } from "./stop-status";

const istHour = vi.fn<() => number>(() => 10);
vi.mock("../day-flag", () => ({ istHour: () => istHour() }));
afterEach(() => vi.clearAllMocks());

describe("effectiveStopStatus", () => {
  it("keeps a pending stop before the 8 PM cutoff", () => {
    istHour.mockReturnValue(19);
    expect(effectiveStopStatus("pending")).toBe("pending");
  });
  it("marks a pending stop missed from 8 PM IST", () => {
    istHour.mockReturnValue(20);
    expect(effectiveStopStatus("pending")).toBe("missed");
  });
  it("passes non-pending statuses through unchanged", () => {
    istHour.mockReturnValue(21);
    expect(effectiveStopStatus("completed")).toBe("completed");
    expect(effectiveStopStatus("checked_in")).toBe("checked_in");
  });
});

describe("isStopDone", () => {
  it("is done only once checked out (completed)", () => {
    expect(isStopDone("completed")).toBe(true);
    expect(isStopDone("checked_in")).toBe(false);
    expect(isStopDone("pending")).toBe(false);
  });
});
