import { describe, expect, it } from "vitest";
import { checkinMarkers, customerMarkers } from "./tracking-map-markers";
import type { MapCustomer } from "@/features/dashboard/map/map-helpers";
import type { TrackingCheckin } from "./tracking-api";

const checkin = (over: Partial<TrackingCheckin> = {}): TrackingCheckin => ({
  visitId: "v1", customerId: "cu1", customerName: "Sri Laxmi", lat: 17, lng: 80,
  checkInAt: "2026-09-14T04:00:00.000Z", planned: "planned", orders: [], collections: [], ...over,
});
const NO_CUSTOMERS = new Map<string, MapCustomer>();

describe("customerMarkers", () => {
  it("shows nothing on hover (no label) and a neutral dot when no dues", () => {
    const m = customerMarkers([
      { name: "A", city: "Nalgonda", lat: 1, lng: 2 } as MapCustomer,
      { name: "B", city: null, lat: 3, lng: 4 } as MapCustomer,
    ]);
    expect(m[0]).toMatchObject({ lat: 1, lng: 2, color: "#94a3b8", radius: 3 });
    expect(m[0].label).toBeUndefined();
    expect(m[1].label).toBeUndefined();
  });

  it("colours the dot by dues bucket and attaches the shared dues popup (click only)", () => {
    const [m] = customerMarkers([
      { id: "c9", name: "Dues Co", city: "Guntur", lat: 5, lng: 6,
        executiveName: "Ravi", outstanding: 5000, bucket: "60_plus" } as MapCustomer,
    ]);
    expect(m.color).toBe("#f43f5e"); // 61+ rose — same palette as the dashboard map
    expect(m.label).toBeUndefined(); // nothing on hover
    expect(m.popup).toContain('href="/customers/c9"');
    expect(m.popup).toContain("Guntur · Ravi");
    expect(m.popup).toContain("due");
  });
});

describe("checkinMarkers", () => {
  it("renders a planned flag with order + collection outcomes and escapes text", () => {
    const [m] = checkinMarkers([checkin({
      customerName: "A & <b>Co</b>",
      orders: [{ id: "o1", code: "ORD-1", litres: 12.5 }],
      collections: [{ id: "c1", code: "COL-1", amount: 5000 }],
    })], NO_CUSTOMERS);
    expect(m.icon).toContain("<svg"); // flag glyph
    expect(m.iconSize).toEqual([24, 24]);
    expect(m.popup).toContain("Planned");
    expect(m.popup).toContain("Checked in");
    expect(m.popup).toContain("/orders/o1");
    expect(m.popup).toMatch(/L\b/); // litres
    expect(m.popup).toContain("/collections/c1");
    expect(m.popup).toContain("A &amp; &lt;b&gt;Co&lt;/b&gt;"); // escaped
    expect(m.popup).not.toContain("View customer"); // the name link is the only customer link
  });

  it("renders an unplanned flag, no-outcome text, and omits the time when missing", () => {
    const [m] = checkinMarkers([checkin({ planned: "unplanned", checkInAt: null })], NO_CUSTOMERS);
    expect(m.popup).toContain("Unplanned");
    expect(m.popup).toContain("No order or collection");
    expect(m.popup).not.toContain("Checked in");
  });

  it("omits the litres suffix when an order has no litres", () => {
    const [m] = checkinMarkers([checkin({ orders: [{ id: "o2", code: "ORD-2", litres: 0 }] })], NO_CUSTOMERS);
    expect(m.popup).toContain("Order ORD-2");
    expect(m.popup).not.toMatch(/·\s*[\d.]+\s*L/);
  });

  it("merges the full customer block (dues + chips) above the visit details", () => {
    const customer = {
      id: "cu1", name: "Sri Laxmi Motors", city: "Wyra", executiveName: "Upendar",
      outstanding: 4208, bucket: "0_30", lastOrderDays: 1, lastCollectionDays: null,
    } as MapCustomer;
    const [m] = checkinMarkers([checkin({ customerId: "cu1" })], new Map([["cu1", customer]]));
    expect(m.popup).toContain('href="/customers/cu1"'); // linked name (only link)
    expect(m.popup).toContain("Wyra · Upendar");
    expect(m.popup).toContain("due"); // dues line
    expect(m.popup).toContain("Last order 1 day ago");
    expect(m.popup).toContain("No collections yet");
    expect(m.popup).toContain("Planned"); // visit details still present
  });
});
