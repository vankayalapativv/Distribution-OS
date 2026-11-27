import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddNoteBox } from "./add-note-box";

const base = {
  draft: "",
  setDraft: () => {},
  error: null as string | null,
  canSave: true,
  saving: false,
  onSave: () => {},
};

describe("AddNoteBox", () => {
  it("saves when allowed and reflects the typed draft", () => {
    const onSave = vi.fn();
    const setDraft = vi.fn();
    render(<AddNoteBox {...base} onSave={onSave} setDraft={setDraft} />);
    fireEvent.change(screen.getByPlaceholderText(/Add a note/), { target: { value: "Prefers mornings" } });
    expect(setDraft).toHaveBeenCalledWith("Prefers mornings");
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalled();
  });

  it("shows the saving label and is disabled while saving / when canSave is false", () => {
    const onSave = vi.fn();
    render(<AddNoteBox {...base} canSave={false} saving onSave={onSave} />);
    fireEvent.click(screen.getByText("Saving…"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the offline warning (which takes precedence over an error)", () => {
    render(<AddNoteBox {...base} offline error="Save failed" />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    expect(screen.queryByText("Save failed")).not.toBeInTheDocument();
  });

  it("shows a save error when online", () => {
    render(<AddNoteBox {...base} error="Save failed" />);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });
});
