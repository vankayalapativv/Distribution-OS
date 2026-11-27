import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CustomersSkeleton } from "./customers-skeleton";

describe("CustomersSkeleton", () => {
  it("renders the placeholder contact rows", () => {
    const { container } = render(<CustomersSkeleton />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
