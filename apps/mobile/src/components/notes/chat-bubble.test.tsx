import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatBubble } from "./chat-bubble";
import type { CustomerNote } from "../../lib/notes/chat-notes";

const note = (over: Partial<CustomerNote> = {}): CustomerNote => ({
  id: "n1", body: "Owner wants 2 cartons", createdAt: "2026-11-27T10:32:00Z",
  authorName: "Priya", edited: false, editedAt: null, editorName: null, ...over,
});

describe("ChatBubble", () => {
  it("renders an incoming note with the author name", () => {
    render(<ChatBubble note={note()} mine={false} />);
    expect(screen.getByText("Priya")).toBeInTheDocument();
    expect(screen.getByText("Owner wants 2 cartons")).toBeInTheDocument();
  });

  it("renders my own note without an author name", () => {
    render(<ChatBubble note={note({ authorName: "Asha" })} mine={true} />);
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
    expect(screen.getByText("Owner wants 2 cartons")).toBeInTheDocument();
  });

  it("shows the edited marker", () => {
    render(<ChatBubble note={note({ edited: true })} mine={false} />);
    expect(screen.getByText("edited")).toBeInTheDocument();
  });
});
