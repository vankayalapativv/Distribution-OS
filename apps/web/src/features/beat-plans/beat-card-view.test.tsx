import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BeatCardView } from "./beat-card-view";
import type { BeatCustomer } from "./beat-plans-api";

vi.mock("@/components/segment-icons", () => ({ SegmentIcons: () => <span>icons</span> }));

const cust = (over: Partial<BeatCustomer> = {}): BeatCustomer => ({
  customerId: "1", customerCode: "C-9", legalName: "Acme", tradeName: null, phone: null,
  city: "Pune", segment: "Car", weekday: 1, sequenceNo: 0, ...over,
});

describe("BeatCardView", () => {
  it("shows the name, city · code meta and a sequence badge on day columns", () => {
    render(<BeatCardView customer={cust()} seq={3} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Pune · C-9")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("omits the meta line when there is no city or code", () => {
    render(<BeatCardView customer={cust({ city: null, customerCode: "" })} seq={null} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders a remove button that fires onRemove without starting a drag", () => {
    const onRemove = vi.fn();
    render(<BeatCardView customer={cust()} seq={1} onRemove={onRemove} />);
    const btn = screen.getByRole("button", { name: "Remove from beat" });
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalled();
  });

  it("has no remove button when onRemove is omitted", () => {
    render(<BeatCardView customer={cust()} seq={null} />);
    expect(screen.queryByRole("button", { name: "Remove from beat" })).not.toBeInTheDocument();
  });

  it("applies overlay + dragging styling", () => {
    const { container } = render(<BeatCardView customer={cust()} seq={null} overlay dragging />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-primary");
    expect(card.className).toContain("opacity-40");
  });
});
