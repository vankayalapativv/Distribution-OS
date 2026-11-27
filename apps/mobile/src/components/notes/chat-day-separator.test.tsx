import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatDaySeparator } from "./chat-day-separator";

describe("ChatDaySeparator", () => {
  it("renders the day label", () => {
    render(<ChatDaySeparator label="Yesterday" />);
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });
});
