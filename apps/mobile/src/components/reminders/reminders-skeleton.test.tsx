import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RemindersSkeleton } from "./reminders-skeleton";

describe("RemindersSkeleton", () => {
  it("renders the placeholder cards", () => {
    const { container } = render(<RemindersSkeleton />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
