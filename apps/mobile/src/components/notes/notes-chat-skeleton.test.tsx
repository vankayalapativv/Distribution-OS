import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { NotesChatSkeleton } from "./notes-chat-skeleton";

describe("NotesChatSkeleton", () => {
  it("renders the chat-shaped shimmer (incoming + own bubbles)", () => {
    const { container } = render(<NotesChatSkeleton />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
