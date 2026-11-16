import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
import type { Gstr1Dataset } from "../services/invoice-gst-export";

// Mutable settings rows the real getSystemSettings() reads through the neon mock.
const state = vi.hoisted(() => ({ rows: [] as Array<{ key: string; value: string }> }));

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({ system_settings_list: () => state.rows })) };
});
vi.mock("../lib/wait-until", () => ({ waitUntilSafe: vi.fn() }));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true), arrayBufferToBase64: vi.fn(() => "B64") }));

const DATASET: Gstr1Dataset = {
  period: { from: "2026-10-01", to: "2026-10-31" },
  seller: { gstin: "36AYJPC8376L1ZU", legalName: "VKR Sales", stateCode: "36" },
  b2b: [], b2cl: [], b2cs: [], cdnr: [], cdnur: [], exemp: [], hsnB2b: [], hsnB2c: [],
  docs: [{ docType: "Invoices for outward supply", firstNo: "GSTAL/893", lastNo: "GSTAL/1079", issued: 187, cancelled: 0 }],
  totals: { invoices: 187, taxable: 1741834.84, tax: 313530.16 },
};
vi.mock("../services/invoice-gst-export", () => ({ getGstr1Dataset: vi.fn().mockResolvedValue(DATASET) }));

const app = () => import("../index").then((m) => m.default);
const CA_ROW = { key: "company_ca_email", value: "ca@firm.in" };

beforeEach(() => {
  vi.resetModules();
  installAuth();
  state.rows = [];
});

describe("GSTR-1 workbook + email routes", () => {
  it("GET /gstr1.xlsx streams a spreadsheet", async () => {
    const res = await (await app()).request("/api/v1/invoices/gstr1.xlsx?from=2026-10-01&to=2026-10-31", { headers: headers("accountant") }, ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toContain("GSTR1-2026-10-01_2026-10-31.xlsx");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("POST /gstr1/email → 422 when no CA email is configured", async () => {
    const res = await (await app()).request("/api/v1/invoices/gstr1/email?from=2026-10-01&to=2026-10-31", { method: "POST", headers: headers("accountant") }, ENV);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("CA_EMAIL_NOT_SET");
  });

  it("POST /gstr1/email → 200 and sends to the configured CA", async () => {
    state.rows = [CA_ROW, { key: "company_legal_name", value: "VKR Sales" }];
    const { sendEmail } = await import("../lib/email");
    const res = await (await app()).request("/api/v1/invoices/gstr1/email?from=2026-10-01&to=2026-10-31", { method: "POST", headers: headers("superAdmin") }, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ sent: true, to: "ca@firm.in" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(sendEmail).mock.calls[0][1];
    expect(msg.to).toBe("ca@firm.in");
    expect(msg.subject).toContain("GSTR-1");
    expect(msg.attachments?.[0].filename).toBe("GSTR1-2026-10-01_2026-10-31.xlsx");
  });

  it("POST /gstr1/email → 503 when the mail provider is unavailable", async () => {
    state.rows = [CA_ROW];
    const { sendEmail } = await import("../lib/email");
    vi.mocked(sendEmail).mockResolvedValueOnce(false);
    const res = await (await app()).request("/api/v1/invoices/gstr1/email?from=2026-10-01&to=2026-10-31", { method: "POST", headers: headers("superAdmin") }, ENV);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("POST /gstr1/email → 403 for a non-office role", async () => {
    const res = await (await app()).request("/api/v1/invoices/gstr1/email?from=2026-10-01&to=2026-10-31", { method: "POST", headers: headers("se") }, ENV);
    expect(res.status).toBe(403);
  });
});
