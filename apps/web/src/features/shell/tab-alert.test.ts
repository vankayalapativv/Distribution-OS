// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { alertHidden, clearTabAlert } from "./tab-alert";

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  Object.defineProperty(document, "visibilityState", {
    value: hidden ? "hidden" : "visible",
    configurable: true,
  });
}

class FakeNotification {
  static permission = "granted";
  static instances: { title: string; options: unknown }[] = [];
  constructor(title: string, options?: unknown) {
    FakeNotification.instances.push({ title, options });
  }
}

afterEach(() => {
  clearTabAlert();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeNotification.instances = [];
});

describe("tab-alert", () => {
  it("does nothing when the tab is visible (the chime is enough)", () => {
    setHidden(false);
    vi.stubGlobal("Notification", FakeNotification);
    const title = document.title;
    alertHidden({ title: "New collection", body: "New collection received", tag: "sri-aparajita-collection" });
    expect(FakeNotification.instances).toHaveLength(0);
    expect(document.title).toBe(title);
  });

  it("when hidden: pops a desktop notification and flashes the tab title", () => {
    vi.useFakeTimers();
    setHidden(true);
    vi.stubGlobal("Notification", FakeNotification);
    document.title = "Sri Aparajita";
    alertHidden({ title: "New collection", body: "New collection received", tag: "sri-aparajita-collection" });
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].title).toBe("New collection");
    expect(FakeNotification.instances[0].options).toMatchObject({
      body: "New collection received",
    });
    vi.advanceTimersByTime(900); // one flash tick
    expect(document.title).toContain("🔔");
    expect(document.title).toContain("1 new alert");
  });

  it("counts multiple hidden arrivals and restores the title on clear", () => {
    vi.useFakeTimers();
    setHidden(true);
    vi.stubGlobal("Notification", FakeNotification);
    document.title = "Sri Aparajita — Orders";
    alertHidden({ title: "New order", body: "a", tag: "sri-aparajita-order" });
    alertHidden({ title: "New collection", body: "b", tag: "sri-aparajita-collection" });
    vi.advanceTimersByTime(900);
    expect(document.title).toContain("2 new alerts");
    clearTabAlert();
    expect(document.title).toBe("Sri Aparajita — Orders");
  });
});
