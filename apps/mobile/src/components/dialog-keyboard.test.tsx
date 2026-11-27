import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Keyboard } from "react-native";
import { useDialogKeyboardHeight } from "./dialog-keyboard";

const listeners: Record<string, (e?: { endCoordinates: { height: number } }) => void> = {};
const remove = vi.fn();

afterEach(() => vi.restoreAllMocks());

function stubKeyboard() {
  vi.spyOn(Keyboard, "addListener").mockImplementation(((evt: string, cb: never) => {
    listeners[evt] = cb;
    return { remove };
  }) as never);
}

describe("useDialogKeyboardHeight", () => {
  it("stays 0 while inactive", () => {
    stubKeyboard();
    const { result } = renderHook(() => useDialogKeyboardHeight(false));
    expect(result.current).toBe(0);
  });

  it("tracks the keyboard height while active and resets on hide/unmount", () => {
    stubKeyboard();
    const { result, unmount } = renderHook(() => useDialogKeyboardHeight(true));
    expect(result.current).toBe(0);
    act(() => listeners["keyboardDidShow"]?.({ endCoordinates: { height: 320 } }));
    expect(result.current).toBe(320);
    act(() => listeners["keyboardDidHide"]?.());
    expect(result.current).toBe(0);
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
