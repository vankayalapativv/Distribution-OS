import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <span data-testid="sk" /> }));

import { ReassignListRowSkeleton } from "./reassign-list-row-skeleton";

describe("ReassignListRowSkeleton", () => {
  it("renders a shimmer row (avatar · lines · count)", () => {
    const { getAllByTestId } = render(<ReassignListRowSkeleton />);
    expect(getAllByTestId("sk").length).toBeGreaterThanOrEqual(5);
  });
});
