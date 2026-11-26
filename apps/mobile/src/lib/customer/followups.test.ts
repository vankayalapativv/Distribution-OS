import { afterEach, describe, expect, it, vi } from "vitest";
import { promptFollowUpAt, resolveFollowup } from "./followups";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const resolveFollowupLocal = vi.fn();
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./followups-store", () => ({
  resolveFollowupLocal: (...a: unknown[]) => resolveFollowupLocal(...a),
  getOpenFollowup: vi.fn(), listFollowupReminders: vi.fn(), pendingFollowupCount: vi.fn(), recordFollowup: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe("resolveFollowup", () => {
  it("resolves locally then best-effort on the server", () => {
    const db = { id: "db" };
    resolveFollowup(db as never, "c1", "tok");
    expect(resolveFollowupLocal).toHaveBeenCalledWith(db, "c1");
    expect(apiFetch).toHaveBeenCalledWith("/followups/customers/c1/resolve", { method: "POST", token: "tok" });
  });
  it("swallows a server failure", () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    expect(() => resolveFollowup({} as never, "c1", null)).not.toThrow();
  });
});

describe("promptFollowUpAt", () => {
  it("opens the in-app date-time picker and returns its result", async () => {
    const pickDateTime = vi.fn().mockResolvedValue("2026-08-05T10:00:00.000Z");
    const res = await promptFollowUpAt({ pickDateTime });
    expect(pickDateTime).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String), message: expect.any(String) }));
    expect(res).toBe("2026-08-05T10:00:00.000Z");
  });
});
