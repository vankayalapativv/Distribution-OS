import { describe, expect, it, vi } from "vitest";
import { Animated } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToastView } from "./toast-view";

const anim = new Animated.Value(0);

describe("ToastView", () => {
  it("renders nothing without a current toast", () => {
    const { container } = render(<ToastView current={null} anim={anim} onPress={() => {}} />);
    expect(container.textContent).toBe("");
  });

  it("renders the message + optional title and fires onPress", () => {
    const onPress = vi.fn();
    render(
      <ToastView
        current={{ key: 1, message: "Saved", title: "Done", variant: "success" }}
        anim={anim}
        onPress={onPress}
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Saved"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders without a title (defaults to the info variant)", () => {
    render(<ToastView current={{ key: 2, message: "Heads up" }} anim={anim} onPress={() => {}} />);
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });
});
