import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/expenditures", () => ({
  EXPENDITURE_TYPES: ["compulsory", "variable"],
  createExpenditure: vi.fn(), createExpenditureCategory: vi.fn(),
  deleteExpenditure: vi.fn().mockResolvedValue({ ok: true }),
  getExpenditureBill: vi.fn().mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg" }),
  getExpenditureById: vi.fn().mockResolvedValue({ id: "e1" }),
  getExpenditureSummary: vi.fn(), listExpenditureCategories: vi.fn(),
  listExpenditurePeople: vi.fn().mockResolvedValue([]),
  listExpenditures: vi.fn(),
  updateExpenditure: vi.fn().mockResolvedValue({ id: "e1", categoryName: "Fuel", amount: 100 }),
  uploadExpenditureBill: vi.fn().mockResolvedValue({ id: "bill1" }),
}));

const jh = (r: Parameters<typeof headers>[0] = "superAdmin") => ({ ...headers(r), "content-type": "application/json" });
const envBucket = { ...ENV, PHOTOS: { get: vi.fn(), put: vi.fn() } };
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
const multipart = async (p: string, fd: FormData, env: unknown = ENV) => {
  const h = { ...headers("manager") } as Record<string, string>;
  delete h["Content-Type"];
  return (await app()).request(new Request(`http://local/api/v1/expenditures${p}`, { method: "POST", headers: h, body: fd }), undefined, env as never);
};

describe("expenditures — people/detail/edit/bill", () => {
  it("GET /people and GET /:id", async () => {
    expect((await (await app()).request("/api/v1/expenditures/people", { headers: headers("accountant") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/expenditures/e1", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("PATCH /:id", async () => {
    const res = await (await app()).request("/api/v1/expenditures/e1", { method: "PATCH", headers: jh("manager"), body: JSON.stringify({ expenditureDate: "2026-06-10", categoryId: "cat1", amount: 100 }) }, ENV);
    expect(res.status).toBe(200);
  });
  it("POST /:id/bill — 500 no bucket, 422 no file, 201 ok", async () => {
    expect((await multipart("/e1/bill", new FormData())).status).toBe(500);
    expect((await multipart("/e1/bill", new FormData(), envBucket)).status).toBe(422);
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array([1, 2])], "bill.pdf", { type: "application/pdf" }));
    expect((await multipart("/e1/bill", fd, envBucket)).status).toBe(201);
  });
  it("GET /:id/bill — 500 no bucket, 200 with bucket", async () => {
    expect((await (await app()).request("/api/v1/expenditures/e1/bill", { headers: headers("manager") }, ENV)).status).toBe(500);
    expect((await (await app()).request("/api/v1/expenditures/e1/bill", { headers: headers("manager") }, envBucket)).status).toBe(200);
  });
});
