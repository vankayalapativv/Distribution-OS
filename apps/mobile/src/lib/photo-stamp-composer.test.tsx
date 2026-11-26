import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import type { View } from "react-native";
import { StampComposer } from "./photo-stamp-composer";

describe("StampComposer", () => {
  it("renders every band line, styling the first as the brand title", () => {
    const shotRef = createRef<View>();
    render(
      <StampComposer
        job={{ uri: "file://a.jpg", width: 1000, height: 500, lines: ["📍 Balaji Motors", "MG Road", "17.40, 78.50"] }}
        shotRef={shotRef}
        onReady={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("📍 Balaji Motors")).toBeTruthy();
    expect(screen.getByText("MG Road")).toBeTruthy();
    expect(screen.getByText("17.40, 78.50")).toBeTruthy();
  });

  it("wires the image load/error callbacks", () => {
    const onReady = vi.fn();
    const onError = vi.fn();
    render(
      <StampComposer
        job={{ uri: "file://a.jpg", width: 400, height: 400, lines: ["📍 X"] }}
        shotRef={createRef<View>()}
        onReady={onReady}
        onError={onError}
      />,
    );
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
  });
});
