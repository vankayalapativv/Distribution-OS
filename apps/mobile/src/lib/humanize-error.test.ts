import { describe, expect, it } from "vitest";
import { ApiRequestError } from "./api";
import { humanizeError } from "./humanize-error";

describe("humanizeError", () => {
  it("prioritizes offline over any specific error", () => {
    // Even a hard 500 reads as "offline" when there's no signal — the specific
    // error is irrelevant if the request never left the device.
    const r = humanizeError(new ApiRequestError("X", "boom", 500), { online: false });
    expect(r.title).toBe("You're offline");
    expect(r.message).toMatch(/sync/i);
  });

  it("maps 5xx to a server-side hiccup, not the raw message", () => {
    const r = humanizeError(new ApiRequestError("X", "PG::deadlock detail...", 503), { online: true });
    expect(r.title).toBe("Server hiccup");
    expect(r.message).not.toMatch(/deadlock/);
  });

  it("maps auth/permission/not-found statuses to distinct copy", () => {
    expect(humanizeError(new ApiRequestError("X", "", 401)).title).toBe("Session expired");
    expect(humanizeError(new ApiRequestError("X", "", 403)).title).toBe("Not allowed");
    expect(humanizeError(new ApiRequestError("X", "", 404)).title).toBe("Not found");
  });

  it("treats timeout/rate-limit as retryable", () => {
    expect(humanizeError(new ApiRequestError("X", "", 408)).title).toBe("Please retry");
    expect(humanizeError(new ApiRequestError("X", "", 429)).title).toBe("Please retry");
  });

  it("surfaces the server message for a real 4xx (validation)", () => {
    const r = humanizeError(new ApiRequestError("X", "Amount exceeds the cash limit.", 422));
    expect(r.title).toBe("Couldn't complete");
    expect(r.message).toBe("Amount exceeds the cash limit.");
  });

  it("classifies a network/timeout Error (online) as a connection problem", () => {
    expect(humanizeError(new Error("Network request failed")).title).toBe("Connection problem");
    expect(humanizeError(new Error("Aborted due to timeout")).title).toBe("Connection problem");
  });

  it("falls back to a generic message for an unknown throw", () => {
    expect(humanizeError({ weird: true }).title).toBe("Something went wrong");
    expect(humanizeError(undefined).title).toBe("Something went wrong");
  });

  it("maps a deactivated account, using the server message or a default", () => {
    expect(humanizeError(new ApiRequestError("ACCOUNT_INACTIVE", "You were removed by admin.", 403)).message).toBe("You were removed by admin.");
    expect(humanizeError(new ApiRequestError("ACCOUNT_INACTIVE", "", 403))).toMatchObject({ title: "Account deactivated", message: expect.stringMatching(/administrator/) });
  });

  it("maps a billing block (402) as a non-blocking warning", () => {
    expect(humanizeError(new ApiRequestError("X", "Subscription overdue.", 402))).toMatchObject({ title: "Payment required", severity: "warning", message: "Subscription overdue." });
    expect(humanizeError(new ApiRequestError("X", "", 402)).message).toMatch(/subscription/i);
  });

  it("uses the server message for 403 when present, else a default", () => {
    expect(humanizeError(new ApiRequestError("X", "This beat is not yours.", 403)).message).toBe("This beat is not yours.");
    expect(humanizeError(new ApiRequestError("X", "", 403)).message).toMatch(/don't have access/);
  });

  it("defaults the 4xx copy when the server sends no message", () => {
    expect(humanizeError(new ApiRequestError("X", "", 422)).message).toMatch(/check your input/i);
  });

  it("falls back to generic for a non-network Error (online)", () => {
    expect(humanizeError(new Error("Cannot read property of undefined")).title).toBe("Something went wrong");
  });

  it("falls through generic handling for an unmapped sub-400 ApiRequestError", () => {
    // status < 400 → friendlyApiError returns null → generic message handling.
    expect(humanizeError(new ApiRequestError("REDIRECT", "weird 302", 302)).title).toBe("Something went wrong");
    // ...and a sub-400 whose message reads as a network issue → connection copy.
    expect(humanizeError(new ApiRequestError("X", "Network request failed", 302)).title).toBe("Connection problem");
  });

  it("defaults to online when opts is omitted", () => {
    // No opts → assume online, so a 500 is a server hiccup (not "offline").
    expect(humanizeError(new ApiRequestError("X", "", 500)).title).toBe("Server hiccup");
  });
});
