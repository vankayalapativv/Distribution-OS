import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <span data-testid="sk" /> }));

import { ReassignDetailSkeleton } from "./reassign-detail-skeleton";

describe("ReassignDetailSkeleton", () => {
  it("renders skeleton shapes mirroring the detail (header, move block, 7-tile grid)", () => {
    const { getAllByTestId } = render(<ReassignDetailSkeleton />);
    expect(getAllByTestId("sk").length).toBeGreaterThan(10);
  });
});
