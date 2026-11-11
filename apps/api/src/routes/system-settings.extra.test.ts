import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/system-settings", () => ({
  getSystemSettings: vi.fn().mockResolvedValue({ company: { legalName: "SA" }, creditOverdueDays: 30 }),
  setCompanyProfile: vi.fn().mockResolvedValue(undefined),
  setCreditOverdueDays: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/invoicing", () => ({
  getInvoiceNumberConfig: vi.fn().mockResolvedValue({ prefix: "SA", nextNumber: 1 }),
  setInvoiceNumberConfig: vi.fn().mockResolvedValue(undefined),
}));
const jh = () => ({ ...headers("superAdmin"), "content-type": "application/json" });
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("system-settings routes", () => {
  it("GET /company (office), /invoice-number", async () => {
    expect((await (await app()).request("/api/v1/system-settings/company", { headers: headers("accountant") }, ENV)).status).toBe(200);
    expect((await (await app()).request("/api/v1/system-settings/invoice-number", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("PUT /invoice-number", async () => {
    expect((await (await app()).request("/api/v1/system-settings/invoice-number", { method: "PUT", headers: jh(), body: JSON.stringify({ prefix: "SA/", nextNumber: 5 }) }, ENV)).status).toBe(200);
  });
  it("PATCH / with credit days + full company (runs field refines)", async () => {
    const company = {
      legalName: "Sri Aparajita", gstin: "22AAAAA0000A1Z5", addressLine1: "1 Road", addressLine2: "",
      city: "Hyderabad", state: "Telangana", pincode: "500001", phone: "9999999999", email: "a@b.co",
      bankAccountName: "SA", bankAccountNumber: "123456", bankIfsc: "HDFC0001234", upiId: "sa@okhdfc",
      termsAndConditions: "Pay in 30 days",
    };
    const res = await (await app()).request("/api/v1/system-settings", { method: "PATCH", headers: jh(), body: JSON.stringify({ creditOverdueDays: 45, company }) }, ENV);
    expect(res.status).toBe(200);
  });
});
