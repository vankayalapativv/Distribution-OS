import { describe, expect, it, vi } from "vitest";
import { Animated } from "react-native";
import { render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { makeSpringPressHandlers, SpringTabButton } from "./spring-tab-button";

const event = {} as never;

describe("makeSpringPressHandlers", () => {
  it("springs down/up and forwards the press callbacks", () => {
    const onPressIn = vi.fn();
    const onPressOut = vi.fn();
    const { pressIn, pressOut } = makeSpringPressHandlers(new Animated.Value(1), onPressIn, onPressOut);
    pressIn(event);
    pressOut(event);
    expect(onPressIn).toHaveBeenCalledWith(event);
    expect(onPressOut).toHaveBeenCalledWith(event);
  });

  it("works with no callbacks provided", () => {
    const { pressIn, pressOut } = makeSpringPressHandlers(new Animated.Value(1));
    expect(() => {
      pressIn(event);
      pressOut(event);
    }).not.toThrow();
  });
});

describe("SpringTabButton", () => {
  it("renders its children", () => {
    render(
      <SpringTabButton style={{ opacity: 1 }}>
        <Text>Home</Text>
      </SpringTabButton>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("renders without a style object", () => {
    render(
      <SpringTabButton>
        <Text>Orders</Text>
      </SpringTabButton>,
    );
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });
});
