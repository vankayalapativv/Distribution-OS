import { renderHook } from "@testing-library/react";
import { type RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProductFieldRefs } from "./use-product-field-refs";
import type { ProductField } from "./product-form-logic";

// rAF → sync so focusField runs immediately; refs are wired to hand-made DOM nodes
// (no test component) to keep clear of the react-hooks render-purity lint rules.
beforeEach(() => vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; }));
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

function attach<T extends HTMLElement>(ref: RefObject<T | null>, el: T) {
  document.body.appendChild(el);
  (ref as { current: T | null }).current = el;
  return el;
}
const focusable = (tag: "input" | "div") =>
  Object.assign(document.createElement(tag), tag === "div" ? { tabIndex: -1 } : {});

describe("useProductFieldRefs.focusField", () => {
  it("focuses the name, hsn, segments and packs fields", () => {
    const r = renderHook(() => useProductFieldRefs()).result.current;
    const cases: Array<[ProductField, HTMLElement]> = [
      ["name", attach(r.nameRef, focusable("input"))],
      ["hsnCode", attach(r.hsnRef, focusable("input"))],
      ["segments", attach(r.segmentsRef, focusable("div"))],
      ["packs", attach(r.packsRef, focusable("div"))],
    ];
    for (const [field, el] of cases) {
      r.focusField(field);
      expect(document.activeElement).toBe(el);
    }
  });

  it("focuses the button inside the brand wrapper", () => {
    const r = renderHook(() => useProductFieldRefs()).result.current;
    const wrap = attach(r.brandRef, document.createElement("div"));
    const btn = wrap.appendChild(document.createElement("button"));
    r.focusField("brand");
    expect(document.activeElement).toBe(btn);
  });

  it("no-ops when the brand wrapper has no button", () => {
    const r = renderHook(() => useProductFieldRefs()).result.current;
    attach(r.brandRef, document.createElement("div"));
    expect(() => r.focusField("brand")).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it("no-ops when a ref was never attached to any node", () => {
    const r = renderHook(() => useProductFieldRefs()).result.current;
    for (const field of ["name", "hsnCode", "brand", "segments", "packs"] as const) {
      expect(() => r.focusField(field)).not.toThrow();
    }
  });
});
