import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/features/tracking/tracking-map-loading", () => ({
  MapLoadingOverlay: () => <div data-testid="overlay-inner" />,
}));

import { MapLoadingFade } from "./map-loading-fade";

describe("MapLoadingFade", () => {
  it("drops itself when its own opacity fade finishes and the map is ready", () => {
    const onGone = vi.fn();
    const { container } = render(<MapLoadingFade ready onGone={onGone} />);
    const fade = container.firstChild as HTMLElement;
    fireEvent.transitionEnd(fade, { propertyName: "opacity" });
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it("ignores the fade while the map is not yet ready", () => {
    const onGone = vi.fn();
    const { container } = render(<MapLoadingFade ready={false} onGone={onGone} />);
    fireEvent.transitionEnd(container.firstChild as HTMLElement, { propertyName: "opacity" });
    expect(onGone).not.toHaveBeenCalled();
  });

  it("ignores transitions of other properties", () => {
    const onGone = vi.fn();
    const { container } = render(<MapLoadingFade ready onGone={onGone} />);
    fireEvent.transitionEnd(container.firstChild as HTMLElement, { propertyName: "transform" });
    expect(onGone).not.toHaveBeenCalled();
  });

  it("ignores transitions bubbled from a child element", () => {
    const onGone = vi.fn();
    const { getByTestId } = render(<MapLoadingFade ready onGone={onGone} />);
    fireEvent.transitionEnd(getByTestId("overlay-inner"), { propertyName: "opacity" });
    expect(onGone).not.toHaveBeenCalled();
  });
});
