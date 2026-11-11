import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";

const apiRequest = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, f: string) => f,
}));

import { useOpeningForm } from "./use-opening-form";
import type { OpeningBalance } from "./opening-balance-logic";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const ob = (): OpeningBalance => ({
  id: "o1",
  asOfDate: "2026-03-31",
  openingAmount: 1000,
  amountCollected: 0,
  outstandingAmount: 1000,
  remarks: "carry",
});
const ev = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

const setup = (initial: OpeningBalance | null, role: "SUPER_ADMIN" | "ACCOUNTANT" = "ACCOUNTANT") => {
  const onDone = vi.fn();
  const { result } = renderHook(() =>
    useOpeningForm({ customerId: "c1", role, actionConfig: cfg, initial, onDone }),
  );
  return { result, onDone };
};

afterEach(() => apiRequest.mockReset());

describe("useOpeningForm", () => {
  it("seeds fields from an existing balance", () => {
    const { result } = setup(ob(), "SUPER_ADMIN");
    expect(result.current.amount).toBe("1000");
    expect(result.current.remarks).toBe("carry");
    expect(result.current.canClear).toBe(true);
  });

  it("saves a new balance via PUT", async () => {
    const { result, onDone } = setup(null);
    act(() => {
      result.current.setAmount("500");
      result.current.setAsOfDate("2026-03-31");
    });
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "PUT", "/customers/c1/opening-balance", {
      asOfDate: "2026-03-31",
      openingAmount: 500,
      remarks: null,
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("blocks submit when locked and reports validation errors", async () => {
    const locked = setup(ob(), "ACCOUNTANT"); // locked
    await act(async () => {
      await locked.result.current.handleSubmit(ev());
    });
    expect(apiRequest).not.toHaveBeenCalled();

    const open = setup(null);
    act(() => open.result.current.setAmount("abc"));
    await act(async () => {
      await open.result.current.handleSubmit(ev());
    });
    expect(open.result.current.error).toBe("Enter a valid amount (0 or more).");
  });

  it("surfaces a save error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("no"));
    const { result } = setup(null);
    act(() => {
      result.current.setAmount("100");
      result.current.setAsOfDate("2026-03-31");
    });
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Couldn't save the opening balance.");
  });

  it("clears an existing balance via DELETE (super admin only)", async () => {
    const denied = setup(ob(), "ACCOUNTANT");
    await act(async () => {
      await denied.result.current.handleClear();
    });
    expect(apiRequest).not.toHaveBeenCalled();

    const { result, onDone } = setup(ob(), "SUPER_ADMIN");
    await act(async () => {
      await result.current.handleClear();
    });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "DELETE", "/customers/c1/opening-balance");
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a clear error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("no"));
    const { result } = setup(ob(), "SUPER_ADMIN");
    await act(async () => {
      await result.current.handleClear();
    });
    expect(result.current.error).toBe("Couldn't clear the opening balance.");
  });
});
