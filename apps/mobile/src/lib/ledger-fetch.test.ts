import { afterEach, describe, expect, it, vi } from "vitest";
import type { LedgerData } from "./ledger";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const EMPTY: LedgerData = {
  from: "2000-01-01",
  to: "2026-07-15",
  openingBalance: 0,
  rows: [],
  totals: { debit: 0, credit: 0, closingBalance: 0 },
};

describe("fetchFullLedger", () => {
  afterEach(() => {
    vi.useRealTimers();
    apiFetch.mockReset();
  });

  it("requests the all-time statement up to today and passes the token through", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00"));
    apiFetch.mockResolvedValue(EMPTY);

    const { fetchFullLedger } = await import("./ledger-fetch");
    const out = await fetchFullLedger("cust-1", "tok-abc");

    expect(out).toBe(EMPTY);
    expect(apiFetch).toHaveBeenCalledWith(
      "/customers/cust-1/ledger?from=2000-01-01&to=2026-07-15",
      { token: "tok-abc" },
    );
  });

  it("forwards a null token (signed-out / pre-auth)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00"));
    apiFetch.mockResolvedValue(EMPTY);

    const { fetchFullLedger } = await import("./ledger-fetch");
    await fetchFullLedger("cust-9", null);

    expect(apiFetch).toHaveBeenCalledWith(
      "/customers/cust-9/ledger?from=2000-01-01&to=2026-01-02",
      { token: null },
    );
  });
});
