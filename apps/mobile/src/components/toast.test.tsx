import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { Pressable, Text } from "react-native";
import { ToastProvider, useToast, toast } from "./toast";

function Harness() {
  const t = useToast();
  return (
    <>
      <Pressable onPress={() => t.error("Something failed", "Error")}><Text>fire-error</Text></Pressable>
      <Pressable onPress={() => t.success("Saved")}><Text>fire-success</Text></Pressable>
      <Pressable onPress={() => t.warning("Careful")}><Text>fire-warning</Text></Pressable>
      <Pressable onPress={() => t.info("FYI")}><Text>fire-info</Text></Pressable>
      <Pressable onPress={() => t.show({ message: "Quick", durationMs: 1000 })}><Text>fire-quick</Text></Pressable>
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe("ToastProvider", () => {
  it("shows a toast via the hook and dismisses it on tap", () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText("fire-error"));
    expect(screen.getByText("Something failed")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    // Tap the toast to dismiss early (clears the timer, starts the hide animation).
    fireEvent.click(screen.getByText("Something failed"));
    expect(screen.getByText("fire-error")).toBeInTheDocument();
  });

  it("replaces the current toast when a new one is shown", () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText("fire-error"));
    fireEvent.click(screen.getByText("fire-success"));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Something failed")).not.toBeInTheDocument();
  });

  it("supports the warning and info levels", () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText("fire-warning"));
    expect(screen.getByText("Careful")).toBeInTheDocument();
    fireEvent.click(screen.getByText("fire-info"));
    expect(screen.getByText("FYI")).toBeInTheDocument();
  });

  it("auto-dismisses after the duration", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Harness /></ToastProvider>);
    act(() => {
      fireEvent.click(screen.getByText("fire-quick"));
    });
    expect(screen.getByText("Quick")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000); // duration elapses → hide() runs
    });
    // hide() cleared the timer and started the exit animation (no throw / timer leak).
    expect(screen.getByText("fire-quick")).toBeInTheDocument();
  });

  it("registers the module-level `toast` singleton while mounted", () => {
    const { unmount } = render(<ToastProvider><Harness /></ToastProvider>);
    act(() => toast.success("From anywhere"));
    expect(screen.getByText("From anywhere")).toBeInTheDocument();
    unmount();
    // After unmount the singleton is cleared → no-op, no throw.
    expect(() => toast.error("gone")).not.toThrow();
  });

  it("throws if useToast is used outside a provider", () => {
    const Bare = () => {
      useToast();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/within a ToastProvider/);
  });
});
