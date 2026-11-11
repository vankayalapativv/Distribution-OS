import { describe, expect, it } from "vitest";
import { formatUploadedAt } from "./collection-receipt-format";

describe("formatUploadedAt", () => {
  it("formats an ISO timestamp with an IST suffix", () => {
    const out = formatUploadedAt("2026-07-24T10:43:00Z");
    expect(out).toMatch(/IST$/);
    expect(out).toMatch(/2026/);
  });

  it("returns an empty string for an unparseable date", () => {
    expect(formatUploadedAt("nonsense")).toBe("");
  });
});
