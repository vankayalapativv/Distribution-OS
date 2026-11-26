import { afterEach, describe, expect, it, vi } from "vitest";
import { showFollowupIfAny } from "./checkin-followup";
import type { LocalDb } from "../local-db";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const getOpenFollowup = vi.fn();
const resolveFollowupLocal = vi.fn();
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./followups", () => ({
  getOpenFollowup: (...a: unknown[]) => getOpenFollowup(...a),
  resolveFollowupLocal: (...a: unknown[]) => resolveFollowupLocal(...a),
}));

const db = {} as LocalDb;
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
afterEach(() => vi.clearAllMocks());

describe("showFollowupIfAny", () => {
  it("no-ops without a local db", async () => {
    await showFollowupIfAny(null, "c1", "Balaji", confirm, "tok");
    expect(getOpenFollowup).not.toHaveBeenCalled();
  });

  it("no-ops when there is no open follow-up", async () => {
    getOpenFollowup.mockReturnValue(null);
    await showFollowupIfAny(db, "c1", "Balaji", confirm, "tok");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("resolves locally + best-effort on server when the SE marks it done", async () => {
    getOpenFollowup.mockReturnValue({ reason: "payment next week", followUpAt: "2026-10-12T09:30:00.000Z" });
    confirm.mockResolvedValueOnce(true);
    await showFollowupIfAny(db, "c1", "Balaji", confirm, "tok");
    const opts = confirm.mock.calls[0][0] as { message: string };
    expect(opts.message).toContain("Follow up:");
    expect(resolveFollowupLocal).toHaveBeenCalledWith(db, "c1");
    expect(apiFetch).toHaveBeenCalledWith("/followups/customers/c1/resolve", { method: "POST", token: "tok" });
  });

  it("omits the date line when there is no follow-up time, and skips resolve on cancel", async () => {
    getOpenFollowup.mockReturnValue({ reason: "stock low", followUpAt: null });
    confirm.mockResolvedValueOnce(false);
    await showFollowupIfAny(db, "c1", "Balaji", confirm, "tok");
    const opts = confirm.mock.calls[0][0] as { message: string };
    expect(opts.message).not.toContain("Follow up:");
    expect(resolveFollowupLocal).not.toHaveBeenCalled();
  });

  it("swallows a failing server resolve (best-effort)", async () => {
    getOpenFollowup.mockReturnValue({ reason: "x", followUpAt: null });
    confirm.mockResolvedValueOnce(true);
    apiFetch.mockRejectedValueOnce(new Error("offline"));
    await showFollowupIfAny(db, "c1", "Balaji", confirm, "tok");
    await Promise.resolve(); // let the .catch microtask settle
    expect(resolveFollowupLocal).toHaveBeenCalled();
  });
});
