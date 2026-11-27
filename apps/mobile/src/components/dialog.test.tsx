import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Pressable, Text, TextInput } from "react-native";
import { DialogProvider, useDialog } from "./dialog";

/** A tiny harness that triggers a dialog and records what it resolves to. */
function Harness({ onResult }: { onResult: (v: unknown) => void }) {
  const d = useDialog();
  return (
    <>
      <Pressable onPress={() => void d.confirm({ title: "Delete?", message: "Sure?", destructive: true }).then(onResult)}>
        <Text>ask-confirm</Text>
      </Pressable>
      <Pressable onPress={() => void d.alert({ title: "Heads up", message: "FYI" }).then(() => onResult("alerted"))}>
        <Text>ask-alert</Text>
      </Pressable>
      <Pressable onPress={() => void d.prompt({ title: "Name?", required: true }).then(onResult)}>
        <Text>ask-prompt</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          void d
            .prompt({ title: "Notes?", minLetters: 2, multiline: true, keyboardType: "number-pad" })
            .then(onResult)
        }
      >
        <Text>ask-rich</Text>
      </Pressable>
    </>
  );
}

const setup = () => {
  const onResult = vi.fn();
  render(
    <DialogProvider>
      <Harness onResult={onResult} />
    </DialogProvider>,
  );
  return onResult;
};

describe("DialogProvider", () => {
  it("resolves confirm true on the primary action", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask-confirm"));
    expect(await screen.findByText("Delete?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("OK"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves confirm false on cancel", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask-confirm"));
    await screen.findByText("Delete?");
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("renders a single-button alert", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask-alert"));
    expect(await screen.findByText("Heads up")).toBeInTheDocument();
    // alert has no Cancel button.
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("OK"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("alerted"));
  });

  it("resolves prompt with the trimmed text", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask-prompt"));
    await screen.findByText("Name?");
    const input = document.querySelector("input, textarea") as HTMLElement;
    fireEvent.change(input, { target: { value: "  Asha  " } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("Asha"));
  });

  it("resolves prompt null on cancel", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask-prompt"));
    await screen.findByText("Name?");
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null));
  });

  it("shows the letter-count hint for a multiline minLetters prompt", async () => {
    setup();
    fireEvent.click(screen.getByText("ask-rich"));
    await screen.findByText("Notes?");
    const input = document.querySelector("input, textarea") as HTMLElement;
    fireEvent.change(input, { target: { value: "a" } }); // 1 letter < minLetters 2
    expect(await screen.findByText(/at least 2 letters/)).toBeInTheDocument();
    // Submit stays disabled while the minimum isn't met.
    fireEvent.click(screen.getByText("Save"));
    expect(screen.getByText("Notes?")).toBeInTheDocument(); // still open
  });

  it("throws if useDialog is used outside the provider", () => {
    const Bare = () => {
      useDialog();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/within DialogProvider/);
  });
});
