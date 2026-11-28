import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can = { approve: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: () => can.approve }));
const claims = { claims: [] as unknown[] };
vi.mock("./use-claims-queue", () => ({ useClaimsQueue: () => claims }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ClaimsNavButton } from "./claims-nav-button";

const config = { apiBaseUrl: "", authToken: "" };
beforeEach(() => { vi.clearAllMocks(); can.approve = true; claims.claims = []; });
afterEach(() => vi.clearAllMocks());

describe("ClaimsNavButton", () => {
  it("renders nothing without the approve permission", () => {
    can.approve = false;
    expect(render(<ClaimsNavButton actionConfig={config} />).container).toBeEmptyDOMElement();
  });

  it("shows a pending-count badge and opens the Claims page", () => {
    claims.claims = [1, 2];
    render(<ClaimsNavButton actionConfig={config} />);
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Claims"));
    expect(push).toHaveBeenCalledWith("/expenditures/claims");
  });

  it("shows no badge when nothing is pending", () => {
    render(<ClaimsNavButton actionConfig={config} />);
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
