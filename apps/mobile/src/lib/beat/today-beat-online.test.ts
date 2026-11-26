import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTodayBeat, type TodayBeat } from "./today-beat-online";
import { cacheKeys } from "../cache-keys";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const cachedFetch = vi.fn<(...a: unknown[]) => Promise<{ data: unknown }>>(() => Promise.resolve({ data: null }));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../read-cache", () => ({ cachedFetch: (...a: unknown[]) => cachedFetch(...a) }));
afterEach(() => vi.clearAllMocks());

describe("fetchTodayBeat", () => {
  it("returns the read-through cached beat and hits /beats/today", async () => {
    const beat = { beatPlanId: "b1", planDate: "2026-11-27", planStatus: "active", stops: [] } as TodayBeat;
    cachedFetch.mockResolvedValue({ data: beat });
    expect(await fetchTodayBeat("tok")).toBe(beat);
    expect(cachedFetch).toHaveBeenCalledWith(cacheKeys.beatToday, expect.any(Function));
    // exercise the fetcher closure
    await (cachedFetch.mock.calls[0][1] as () => Promise<unknown>)();
    expect(apiFetch).toHaveBeenCalledWith("/beats/today", { token: "tok" });
  });
});
