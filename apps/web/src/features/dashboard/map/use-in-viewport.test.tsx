import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useInViewport } from "./use-in-viewport";

function Probe() {
  const { ref, inView } = useInViewport();
  return <div ref={ref} data-inview={String(inView)} />;
}

const OriginalIO = globalThis.IntersectionObserver;
afterEach(() => {
  globalThis.IntersectionObserver = OriginalIO;
});

describe("useInViewport", () => {
  it("treats missing IntersectionObserver as immediately in view", () => {
    // @ts-expect-error — simulate a browser without IO.
    delete globalThis.IntersectionObserver;
    const { container } = render(<Probe />);
    expect(container.firstChild).toHaveAttribute("data-inview", "true");
  });

  it("flips to in-view when the element intersects", () => {
    let trigger: ((e: { isIntersecting: boolean }[]) => void) | null = null;
    class MockIO {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) { trigger = cb; }
      observe() {}
      disconnect() {}
    }
    globalThis.IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
    const { container } = render(<Probe />);
    expect(container.firstChild).toHaveAttribute("data-inview", "false");
    act(() => trigger!([{ isIntersecting: false }])); // no intersection → stays false
    expect(container.firstChild).toHaveAttribute("data-inview", "false");
    act(() => trigger!([{ isIntersecting: true }]));
    expect(container.firstChild).toHaveAttribute("data-inview", "true");
  });
});
