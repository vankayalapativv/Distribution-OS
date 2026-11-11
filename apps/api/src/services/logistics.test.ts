import { describe, expect, it } from "vitest";
import { listDeliveryCustomers } from "./logistics";
import { makeSql } from "../test/sql-mock";

describe("listDeliveryCustomers", () => {
  it("applies from+to date filters and maps rows (null date → '')", async () => {
    const sql = makeSql({
      logistics_customers_count: [{ total: 1 }],
      logistics_customers: [{ customerId: "c1", customerName: "Ravi", customerCode: "C1", area: "Hyd", deliveryCount: "2", lastDeliveryDate: null, photoCount: "1" }],
    });
    const res = await listDeliveryCustomers(sql, { from: "2026-06-01", to: "2026-06-30", page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.rows[0]).toMatchObject({ customerId: "c1", lastDeliveryDate: "" });
    const countCall = sql.calls.find((c) => c.tag === "logistics_customers_count")!;
    expect(countCall.params).toContain("2026-06-30"); // the `to` filter param
  });
});

import { getCustomerDeliveryDetail, getDeliveryPhotoStream, listDeliveryStops } from "./logistics";
import { vi } from "vitest";

describe("listDeliveryStops", () => {
  it("maps each stop (null coercions tolerated)", async () => {
    const sql = makeSql({
      logistics_stops_count: [{ total: 1 }],
      logistics_stops: [{ stopId: "s1", runId: "r1", date: null, createdAt: "2026-06-01T09:00:00Z", customerId: "c1", customerName: "Ravi", customerCode: "C1", driverName: null, vehicleNumber: null, latitude: null, longitude: null, photoCount: "2" }],
    });
    const res = await listDeliveryStops(sql, { q: "ravi" });
    expect(res.rows[0]).toMatchObject({ stopId: "s1", date: "", latitude: null, photoCount: 2 });
  });
});

describe("getCustomerDeliveryDetail", () => {
  it("404s a missing customer", async () => {
    await expect(getCustomerDeliveryDetail(makeSql({ logistics_customer: [] }), "x", {})).rejects.toMatchObject({ status: 404 });
  });
  it("returns the customer + events with photos grouped by stop", async () => {
    const sql = makeSql({
      logistics_customer: [{ id: "c1", customerName: "Ravi", customerCode: "C1", phone: "999", address: "Main Rd", landmark: null }],
      logistics_customer_stops: [{ stopId: "s1", runId: "r1", date: "2026-06-01", createdAt: "2026-06-01T09:00:00Z", driverName: "Drv", vehicleNumber: "TS01", latitude: "17.4", longitude: "78.4" }],
      logistics_customer_photos: [{ id: "p1", stopId: "s1", kind: "delivery", contentType: "image/jpeg", createdAt: "2026-06-01T09:05:00Z" }],
    });
    const out = await getCustomerDeliveryDetail(sql, "c1", { from: "2026-06-01", to: "2026-06-30" });
    expect(out.customer).toMatchObject({ customerId: "c1" });
    expect(out.events[0].photos).toHaveLength(1);
  });
});

describe("getDeliveryPhotoStream", () => {
  it("streams the photo, or 404s a missing row / missing object", async () => {
    const bucket = { get: vi.fn().mockResolvedValue({ body: "STREAM" }) } as never;
    const sql = makeSql({ logistics_photo_by_id: [{ id: "p1", fileKey: "k1", contentType: "image/png" }] });
    expect(await getDeliveryPhotoStream(sql, bucket, "p1")).toMatchObject({ contentType: "image/png" });
    await expect(getDeliveryPhotoStream(makeSql({ logistics_photo_by_id: [] }), bucket, "x")).rejects.toMatchObject({ status: 404 });
    const gone = { get: vi.fn().mockResolvedValue(null) } as never;
    await expect(getDeliveryPhotoStream(makeSql({ logistics_photo_by_id: [{ id: "p1", fileKey: "k1" }] }), gone, "p1")).rejects.toMatchObject({ status: 404 });
  });
});
