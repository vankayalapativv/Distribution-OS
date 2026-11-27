import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { CollectionConfirmation } from "./confirmation";
import { PAYMENT_MODES } from "../../lib/collection/constants";

const mode = PAYMENT_MODES[0];

beforeEach(() => (router.back as ReturnType<typeof vi.fn>).mockClear?.());

describe("CollectionConfirmation", () => {
  it("shows the recorded state with the server code and navigates back / resets", () => {
    const onReset = vi.fn();
    render(
      <CollectionConfirmation code="COL-1" amountNum={5000} mode={mode.key} collectionType="general" onReset={onReset} />,
    );
    expect(screen.getByText("Collection recorded")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`COL-1 · ${mode.label}`))).toBeInTheDocument();
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
    expect(screen.getByText(/Pending accountant verification/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back to customer"));
    expect(router.back).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Start another"));
    expect(onReset).toHaveBeenCalled();
  });

  it("shows the offline-queued state (no code) for an advance payment", () => {
    render(
      <CollectionConfirmation code="" queued amountNum={1000} mode={mode.key} collectionType="advance" onReset={() => {}} />,
    );
    expect(screen.getByText("Collection saved")).toBeInTheDocument();
    expect(screen.getByText(/advance payment/)).toBeInTheDocument();
    expect(screen.getByText(/Saved on this device/)).toBeInTheDocument();
  });
});
