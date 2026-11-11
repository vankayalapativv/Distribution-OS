import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Shipment } from "./orders-api";
import { ShipmentCard } from "./order-shipment-card";

function ship(over: Partial<Shipment> = {}): Shipment {
  return {
    id: "s1", code: "INV-1", date: "2026-08-01", total: 0, outstanding: 0,
    oilLitres: 0, invoicedAt: "2026-08-01T00:00:00Z", delivered: false, deliveredAt: null,
    ...over,
  };
}

describe("ShipmentCard", () => {
  it("summarises the oil litres", () => {
    render(<ShipmentCard s={ship({ oilLitres: 20 })} />);
    expect(screen.getByText(/20 L oils/)).toBeInTheDocument();
    expect(screen.getByText("INV-1")).toBeInTheDocument();
  });

  it("shows a Delivered badge and delivered date when delivered", () => {
    render(<ShipmentCard s={ship({ delivered: true, deliveredAt: "2026-08-05T00:00:00Z" })} />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText(/Delivered .*2026/)).toBeInTheDocument();
  });

  it("shows a Not delivered badge otherwise", () => {
    render(<ShipmentCard s={ship()} />);
    expect(screen.getByText("Not delivered")).toBeInTheDocument();
  });
});
