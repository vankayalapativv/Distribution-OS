import { describe, expect, it, vi } from "vitest";
import { MAX_BUFFER, enqueueError, flushErrorBuffer, readErrorBuffer, writeErrorBuffer } from "./error-buffer";
import type { LocalDb } from "./local-db";

// Minimal in-memory LocalDb modelling the single-row performance_cache buffer:
// `run` persists the JSON string (2nd param), `first` hands it back.
function makeDb(initial: string | null = null): LocalDb {
  let payload = initial;
  return {
    exec: () => undefined,
    run: (_sql: string, params: unknown[] = []) => {
      payload = String(params[1]);
    },
    all: () => [],
    first: <T>() => (payload == null ? null : ({ payload_json: payload } as unknown as T)),
  } as unknown as LocalDb;
}

describe("error-buffer", () => {
  it("round-trips an enqueued report", () => {
    const db = makeDb();
    enqueueError(db, { message: "boom" });
    expect(readErrorBuffer(db)).toEqual([{ message: "boom" }]);
  });

  it("is a ring buffer capped at MAX_BUFFER (keeps the most recent)", () => {
    const db = makeDb();
    for (let i = 1; i <= MAX_BUFFER + 10; i++) enqueueError(db, { n: i });
    const items = readErrorBuffer<{ n: number }>(db);
    expect(items).toHaveLength(MAX_BUFFER);
    // Oldest 10 dropped → first kept is n=11, last is the newest.
    expect(items[0].n).toBe(11);
    expect(items[items.length - 1].n).toBe(MAX_BUFFER + 10);
  });

  it("clears the buffer when every item sends", async () => {
    const db = makeDb();
    enqueueError(db, { m: "a" });
    enqueueError(db, { m: "b" });
    const post = vi.fn().mockResolvedValue(true);
    await flushErrorBuffer(db, post);
    expect(post).toHaveBeenCalledTimes(2);
    expect(readErrorBuffer(db)).toEqual([]);
  });

  it("keeps only the items that still fail (mid-flush flap doesn't drop them)", async () => {
    const db = makeDb();
    for (const m of ["a", "b", "c", "d"]) enqueueError(db, { m });
    // b and d fail; a and c succeed.
    const post = vi.fn(async (item: { m: string }) => item.m !== "b" && item.m !== "d");
    await flushErrorBuffer(db, post);
    expect(readErrorBuffer(db)).toEqual([{ m: "b" }, { m: "d" }]);
  });

  it("no-ops flush on an empty buffer", async () => {
    const db = makeDb();
    const post = vi.fn().mockResolvedValue(true);
    await flushErrorBuffer(db, post);
    expect(post).not.toHaveBeenCalled();
  });

  it("returns [] for a null db, a missing row, or unparseable JSON (never throws)", () => {
    expect(readErrorBuffer(null)).toEqual([]);
    expect(readErrorBuffer(makeDb())).toEqual([]); // no row yet
    expect(readErrorBuffer(makeDb("not json"))).toEqual([]);
  });

  it("writeErrorBuffer on a null db is a silent no-op", () => {
    expect(() => writeErrorBuffer(null, [{ x: 1 }])).not.toThrow();
  });
});
