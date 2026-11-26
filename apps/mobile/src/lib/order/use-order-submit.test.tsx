import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOrderSubmit } from "./use-order-submit";
import type { OrderCart } from "./use-order-cart";

const submitWrite = vi.fn();
const kickSync = vi.fn();
const submitOrder = vi.fn();
const recordOrder = vi.fn();
const getLocalDb = vi.fn<() => unknown>(() => null);
let uuidSeq = 0;

vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++uuidSeq}` }));
vi.mock("../day-flag", () => ({ istDate: () => "2026-08-05" }));
vi.mock("../online-first", () => ({ submitWrite: (...a: unknown[]) => submitWrite(...a) }));
vi.mock("../sync", () => ({ kickSync: (...a: unknown[]) => kickSync(...a) }));
vi.mock("../db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./order-queue", () => ({ recordOrder: (...a: unknown[]) => recordOrder(...a) }));
vi.mock("./api", () => ({ submitOrder: (...a: unknown[]) => submitOrder(...a) }));

type WriteArg = {
  send: () => unknown;
  queue: () => void;
};

function cart(over: Partial<OrderCart> = {}): OrderCart {
  return { canSubmit: true, items: [{ productId: "p1", quantityUnits: 1 }], ...over } as unknown as OrderCart;
}

afterEach(() => {
  submitWrite.mockReset();
  kickSync.mockReset();
  submitOrder.mockReset();
  recordOrder.mockReset();
  getLocalDb.mockReset();
  getLocalDb.mockReturnValue(null);
  uuidSeq = 0;
});

describe("useOrderSubmit", () => {
  it("records the order code on a sent outcome", async () => {
    submitWrite.mockResolvedValue({ status: "sent", data: { orderCode: "ORD-1" } });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.result).toEqual({ orderCode: "ORD-1" });
    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("flags a queued outcome and kicks a sync", async () => {
    submitWrite.mockResolvedValue({ status: "queued" });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.result).toEqual({ orderCode: "", queued: true });
    expect(kickSync).toHaveBeenCalledOnce();
  });

  it("shows the on-device save error for an unsaved outcome", async () => {
    submitWrite.mockResolvedValue({ status: "unsaved" });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toMatch(/Couldn't save the order on this device/);
  });

  it("shows the rejection error for a rejected outcome", async () => {
    submitWrite.mockResolvedValue({ status: "rejected" });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toMatch(/server rejected this order/);
  });

  it("surfaces a thrown error message", async () => {
    submitWrite.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe("boom");
    expect(result.current.submitting).toBe(false);
  });

  it("surfaces a generic message when a non-Error is thrown", async () => {
    submitWrite.mockRejectedValue("nope");
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toMatch(/Could not place the order/);
  });

  it("does nothing without a customer or when the cart can't submit", async () => {
    const noCust = renderHook(() => useOrderSubmit(undefined, "tok", cart()));
    await act(async () => { await noCust.result.current.submit(); });
    const cantSubmit = renderHook(() => useOrderSubmit("c1", "tok", cart({ canSubmit: false })));
    await act(async () => { await cantSubmit.result.current.submit(); });
    expect(submitWrite).not.toHaveBeenCalled();
  });

  it("ignores a re-entrant submit while one is in flight", async () => {
    let release!: (v: unknown) => void;
    submitWrite.mockReturnValue(new Promise((r) => { release = r; }));
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    let first!: Promise<void>;
    act(() => { first = result.current.submit(); });
    expect(result.current.submitting).toBe(true);
    await act(async () => { await result.current.submit(); }); // ignored
    await act(async () => { release({ status: "sent", data: { orderCode: "ORD-1" } }); await first; });
    expect(submitWrite).toHaveBeenCalledOnce();
  });

  it("does not set state after unmount mid-submit", async () => {
    let release!: (v: unknown) => void;
    submitWrite.mockReturnValue(new Promise((r) => { release = r; }));
    const { result, unmount } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    let p!: Promise<void>;
    act(() => { p = result.current.submit(); });
    unmount();
    await act(async () => { release({ status: "sent", data: { orderCode: "ORD-9" } }); await p; });
    // No throw / no act warning = the mounted guard held.
    expect(submitWrite).toHaveBeenCalledOnce();
  });

  it("does not set the error after unmount when a submit throws", async () => {
    let reject!: (e: unknown) => void;
    submitWrite.mockReturnValue(new Promise((_r, rej) => { reject = rej; }));
    const { result, unmount } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    let p!: Promise<void>;
    act(() => { p = result.current.submit(); });
    unmount();
    await act(async () => { reject(new Error("late")); await p; });
    expect(submitWrite).toHaveBeenCalledOnce();
  });

  it("reuses the idempotency key across retries until reset", async () => {
    submitWrite.mockResolvedValue({ status: "rejected" });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    await act(async () => { await result.current.submit(); }); // no reset → same key
    expect(uuidSeq).toBe(1);
  });

  it("passes a send() that POSTs the order and a queue() backed by the local outbox", async () => {
    submitWrite.mockResolvedValue({ status: "sent", data: { orderCode: "ORD-1" } });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });

    const arg = submitWrite.mock.calls.at(-1)![0] as WriteArg;

    // send() → POST /orders with the token
    arg.send();
    expect(submitOrder).toHaveBeenCalledWith("tok", expect.objectContaining({ customerId: "c1", orderDate: "2026-08-05" }));

    // queue() with no local db → throws so submitWrite reports "unsaved"
    getLocalDb.mockReturnValue(null);
    expect(() => arg.queue()).toThrow(/no local db/);

    // queue() with a db → records the order to the outbox
    getLocalDb.mockReturnValue({});
    arg.queue();
    expect(recordOrder).toHaveBeenCalledWith({}, expect.objectContaining({ customerId: "c1", clientUuid: expect.any(String) }), expect.any(Number));
  });

  it("reset clears result and error and mints a fresh idempotency key", async () => {
    submitWrite.mockResolvedValue({ status: "sent", data: { orderCode: "ORD-1" } });
    const { result } = renderHook(() => useOrderSubmit("c1", "tok", cart()));
    await act(async () => { await result.current.submit(); });
    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    await act(async () => { await result.current.submit(); });
    // Two separate attempts → two minted UUIDs.
    expect(uuidSeq).toBe(2);
  });
});
