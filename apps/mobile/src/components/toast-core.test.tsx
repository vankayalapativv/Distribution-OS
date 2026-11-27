import { afterEach, describe, expect, it, vi } from "vitest";
import { setToastSingleton, toast, VARIANT } from "./toast-core";

afterEach(() => setToastSingleton(null));

describe("toast singleton", () => {
  it("is a no-op before a provider registers it", () => {
    expect(() => toast.error("boom")).not.toThrow();
    expect(() => toast.show({ message: "x" })).not.toThrow();
  });

  it("forwards each level to the registered api, then no-ops once cleared", () => {
    const show = vi.fn();
    setToastSingleton({ show, error: () => {}, warning: () => {}, success: () => {}, info: () => {} });
    toast.error("e", "E");
    toast.warning("w");
    toast.success("s");
    toast.info("i");
    toast.show({ message: "m" });
    expect(show).toHaveBeenCalledTimes(5);
    expect(show).toHaveBeenCalledWith({ message: "e", title: "E", variant: "error" });
    setToastSingleton(null);
    toast.error("after");
    expect(show).toHaveBeenCalledTimes(5); // cleared → no further calls
  });

  it("maps every variant to a colour + icon", () => {
    expect(Object.keys(VARIANT)).toEqual(["error", "warning", "success", "info"]);
    expect(VARIANT.error.color).toBe("#dc2626");
  });
});
