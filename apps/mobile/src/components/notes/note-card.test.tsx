import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoteCard, type CustomerNote } from "./note-card";

const note = (over: Partial<CustomerNote> = {}): CustomerNote => ({
  id: "n1",
  body: "Customer prefers morning visits.",
  createdAt: "2026-08-09T09:15:00",
  authorName: "Asha",
  edited: false,
  editedAt: null,
  editorName: null,
  ...over,
});

describe("NoteCard", () => {
  it("renders the author, timestamp and body (no edit marker)", () => {
    render(<NoteCard note={note()} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText(/9 Aug 2026/)).toBeInTheDocument();
    expect(screen.getByText("Customer prefers morning visits.")).toBeInTheDocument();
    expect(screen.queryByText("edited")).not.toBeInTheDocument();
  });

  it("shows the edited marker and editor line when edited", () => {
    render(<NoteCard note={note({ edited: true, editorName: "Super Admin", editedAt: "2026-08-10T14:30:00" })} />);
    expect(screen.getByText("edited")).toBeInTheDocument();
    expect(screen.getByText(/edited by Super Admin/)).toBeInTheDocument();
    expect(screen.getByText(/10 Aug 2026/)).toBeInTheDocument();
  });

  it("shows the edited marker but no editor line when the editor is unknown", () => {
    render(<NoteCard note={note({ edited: true, editorName: null })} />);
    expect(screen.getByText("edited")).toBeInTheDocument();
    expect(screen.queryByText(/edited by/)).not.toBeInTheDocument();
  });

  it("shows the editor line without a timestamp when editedAt is missing", () => {
    render(<NoteCard note={note({ edited: true, editorName: "Super Admin", editedAt: null })} />);
    expect(screen.getByText(/edited by Super Admin/)).toBeInTheDocument();
  });
});
