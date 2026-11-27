import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotesComposeBar } from "./notes-compose-bar";

const base = { draft: "", onChange: vi.fn(), canSave: true, saving: false, onSave: vi.fn() };

describe("NotesComposeBar", () => {
  it("edits the draft and sends", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<NotesComposeBar {...base} onChange={onChange} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText("Add a note…"), { target: { value: "Hi" } });
    expect(onChange).toHaveBeenCalledWith("Hi");
    fireEvent.click(screen.getByLabelText("Send note"));
    expect(onSave).toHaveBeenCalled();
  });

  it("disables send and shows the offline hint when offline", () => {
    const onSave = vi.fn();
    render(<NotesComposeBar {...base} canSave={false} offline onSave={onSave} />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Send note"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows a save error (online) and keeps the input while saving", () => {
    render(<NotesComposeBar {...base} error="Couldn't save the note. Please try again." saving />);
    expect(screen.getByText(/Couldn't save the note/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a note…")).toBeInTheDocument();
  });

  it("renders with no hint when online and error-free", () => {
    render(<NotesComposeBar {...base} />);
    expect(screen.queryByText(/offline/)).not.toBeInTheDocument();
  });
});
