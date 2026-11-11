import { describe, expect, it } from "vitest";
import { customerDotPopup, districtCountIcon } from "./map-markers";
import { bandMeta, type MapCustomer } from "./map-helpers";

const META = bandMeta(undefined); // default 4 bands, keys "0".."3"

const cust = (over: Partial<MapCustomer>): MapCustomer => ({
  id: "c1", name: "Ravi Motors", code: "C", city: "Guntur", lat: 17, lng: 78,
  executiveId: "e", executiveName: "Ravi", outstanding: 0, ageDays: null, bucket: null,
  lastOrderDays: null, lastCollectionDays: null, active: true,
  ...over,
});

describe("customerDotPopup", () => {
  it("links the name, shows city · executive meta and a bucket-coloured dues line", () => {
    const html = customerDotPopup(cust({ outstanding: 5000, bucket: "1" }), META);
    expect(html).toContain('href="/customers/c1"');
    expect(html).toContain("Guntur · Ravi");
    expect(html).toContain("31–45 days"); // the band's label
    expect(html).toContain("#eab308"); // ₹ amount coloured by band ordinal 1
  });
  it("omits the meta line when no city/executive and shows a grey 'No dues'", () => {
    const html = customerDotPopup(cust({ city: null, executiveName: null, outstanding: 0 }), META);
    expect(html).not.toContain("·");
    expect(html).toContain("No dues");
    expect(html).toContain("#94a3b8"); // neutral grey, not green
  });
  it("renders colour-graded last-order / last-collection activity chips", () => {
    const html = customerDotPopup(cust({ lastOrderDays: 1, lastCollectionDays: 20 }), META);
    expect(html).toContain("Last order 1 day ago");
    expect(html).toContain("#dcfce7"); // order ≤21 → green pill
    expect(html).toContain("Last collection 20 days ago");
    expect(html).toContain("#fee2e2"); // collection 15+ → red pill
  });
  it("shows red 'No orders/collections yet' chips when the customer never did either", () => {
    const html = customerDotPopup(cust({ lastOrderDays: null, lastCollectionDays: null }), META);
    expect(html).toContain("No orders yet");
    expect(html).toContain("No collections yet");
  });
});

describe("districtCountIcon", () => {
  it("builds a Leaflet divIcon with a pluralised title", () => {
    expect(String(districtCountIcon("Hyderabad", 1).options.html)).toContain("1 customer");
    expect(String(districtCountIcon("Hyderabad", 5).options.html)).toContain("5 customers");
  });
});
