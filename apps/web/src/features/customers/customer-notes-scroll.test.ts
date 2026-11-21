import { describe, expect, it } from "vitest";
import { stickToBottom } from "./customer-notes-scroll";

describe("stickToBottom", () => {
  it("scrolls a mounted element to its bottom", () => {
    const el = { scrollTop: 0, scrollHeight: 500 } as HTMLElement;
    stickToBottom(el);
    expect(el.scrollTop).toBe(500);
  });
  it("is a no-op when the element isn't mounted yet", () => {
    expect(() => stickToBottom(null)).not.toThrow();
  });
});
