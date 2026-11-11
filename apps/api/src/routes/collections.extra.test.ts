import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: (_c: unknown, p: Promise<unknown>) => p }));
vi.mock("../lib/geocode", () => ({ photoGeoFromForm: vi.fn().mockResolvedValue(null) }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/collections", () => ({
  VALID_PAYMENT_MODES: new Set(["cash", "credit_note", "cheque", "upi"]),
  VALID_COLLECTION_TYPES: new Set(["general", "against_invoice"]),
  listCollections: vi.fn().mockResolvedValue([]),
  listCollectionsPaged: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 }),
  getCollectionById: vi.fn().mockResolvedValue({ id: "col1" }),
  createCollection: vi.fn().mockResolvedValue({ existing: false, id: "col1", collectionCode: "COLL-1", collectionAmount: 5000 }),
  updateCollection: vi.fn().mockResolvedValue({ id: "col1", collectionCode: "COLL-1", collectionAmount: 5000 }),
  listCollectors: vi.fn().mockResolvedValue([]),
  verifyCollection: vi.fn(), rejectCollection: vi.fn(),
}));
vi.mock("../services/collection-proofs", () => ({
  getCollectionProof: vi.fn().mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg" }),
  uploadCollectionProof: vi.fn().mockResolvedValue({ existing: false, id: "pr1" }),
}));
vi.mock("../services/customers", () => ({ assertCustomerVisible: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/web-push-notify", () => ({
  customerName: vi.fn().mockResolvedValue("Ravi"),
  executiveFirstName: vi.fn().mockResolvedValue("Asha"),
  inr: (n: number) => `₹${n}`,
  notifyOfficeWebPush: vi.fn().mockResolvedValue(undefined),
  vapidFromEnv: () => ({ publicKey: "p", privateKey: "s", subject: "mailto:a@b.co" }),
}));
vi.mock("../services/admin-notify", () => ({ notifyAdmins: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/notify-format", () => ({ collectionBody: () => "Asha · ₹5000 · Ravi" }));

const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
const envBucket = { ...ENV, PHOTOS: { get: vi.fn(), put: vi.fn() } };
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
const multipart = async (p: string, r: Parameters<typeof headers>[0], fd: FormData, env: unknown = ENV) => {
  const h = { ...headers(r) } as Record<string, string>;
  delete h["Content-Type"];
  return (await app()).request(new Request(`http://local/api/v1/collections${p}`, { method: "POST", headers: h, body: fd }), undefined, env as never);
};

describe("collections — paged/collectors/create/proof/patch", () => {
  it("GET /paged and /collectors", async () => {
    expect((await (await app()).request("/api/v1/collections/paged?status=pending&search=x&customerId=c1&collectedBy=se-1&fromDate=2026-06-01&toDate=2026-06-30&sort=date&dir=desc&page=1&pageSize=20", { headers: headers("manager") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/collections/collectors", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("POST / — SE create fires notifications", async () => {
    const res = await (await app()).request("/api/v1/collections", { method: "POST", headers: jh("se"), body: JSON.stringify({ customerId: "c1", collectionDate: "2026-06-10", paymentMode: "cash", collectionAmount: 5000 }) }, ENV);
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 20));
    const { notifyOfficeWebPush } = await import("../services/web-push-notify");
    expect(notifyOfficeWebPush).toHaveBeenCalled();
  });
  it("POST / — 422 invalid collection type and non-positive amount", async () => {
    expect((await (await app()).request("/api/v1/collections", { method: "POST", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", collectionDate: "2026-06-10", paymentMode: "cash", collectionType: "bogus", collectionAmount: 10 }) }, ENV)).status).toBe(422);
    expect((await (await app()).request("/api/v1/collections", { method: "POST", headers: jh("manager"), body: JSON.stringify({ customerId: "c1", collectionDate: "2026-06-10", paymentMode: "cash", collectionAmount: 0 }) }, ENV)).status).toBe(422);
  });
  it("POST /:id/proof — 500 no bucket, 422 no file, 201 ok", async () => {
    expect((await multipart("/col1/proof", "manager", new FormData())).status).toBe(500);
    expect((await multipart("/col1/proof", "manager", new FormData(), envBucket)).status).toBe(422);
    const fd = new FormData();
    fd.append("photo", new File([new Uint8Array([1, 2])], "r.jpg", { type: "image/jpeg" }));
    expect((await multipart("/col1/proof", "manager", fd, envBucket)).status).toBe(201);
  });
  it("PATCH /:id edits a credit note (SUPER_ADMIN)", async () => {
    const res = await (await app()).request("/api/v1/collections/col1", { method: "PATCH", headers: jh(), body: JSON.stringify({ collectionDate: "2026-06-10", paymentMode: "credit_note", collectionAmount: 5000 }) }, ENV);
    expect(res.status).toBe(200);
  });
});
