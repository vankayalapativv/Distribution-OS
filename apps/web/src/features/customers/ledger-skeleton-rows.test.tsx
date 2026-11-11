import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LedgerSkeletonRows } from "./ledger-skeleton-rows";

describe("LedgerSkeletonRows", () => {
  it("renders eight skeleton rows of ten cells", () => {
    const { container } = render(
      <table>
        <tbody>
          <LedgerSkeletonRows />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("tr")).toHaveLength(8);
    expect(container.querySelectorAll("td")).toHaveLength(80);
  });
});
