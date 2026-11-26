import { afterEach, describe, expect, it } from "vitest";
import {
  getClientSessionId,
  getForegroundWatch,
  setClientSessionId,
  setForegroundWatch,
} from "./gps-state";

afterEach(() => {
  setClientSessionId(null);
  setForegroundWatch(null);
});

describe("gps-state accessors", () => {
  it("round-trips the client session id", () => {
    expect(getClientSessionId()).toBeNull();
    setClientSessionId("cs-1");
    expect(getClientSessionId()).toBe("cs-1");
    setClientSessionId(null);
    expect(getClientSessionId()).toBeNull();
  });

  it("round-trips the foreground watch subscription", () => {
    expect(getForegroundWatch()).toBeNull();
    const sub = { remove: () => {} } as unknown as ReturnType<typeof getForegroundWatch>;
    setForegroundWatch(sub);
    expect(getForegroundWatch()).toBe(sub);
  });
});
