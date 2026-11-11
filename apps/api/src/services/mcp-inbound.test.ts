import { afterEach, describe, expect, it, vi } from "vitest";
import { getInboundAudit, getInboundStatus, patchInboundConfig } from "./mcp-inbound";

const ENV = { MCP_SERVER_ORIGIN: "https://mcp.test/", MCP_ADMIN_SECRET: "s3cr3t" };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(body === null ? "" : JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe("getInboundStatus", () => {
  it("returns a configured:false stub when the API is not wired to the server", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const status = await getInboundStatus({});
    expect(status.configured).toBe(false);
    expect(status.enabled).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("proxies /admin/status and wraps it as configured:true, with a bearer secret and trimmed base", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ enabled: true, passphrase: "p", passphraseSet: true }));
    const status = await getInboundStatus(ENV);
    expect(status).toMatchObject({ configured: true, enabled: true, passphrase: "p" });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://mcp.test/admin/status"); // trailing slash trimmed
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer s3cr3t");
  });
});

describe("patchInboundConfig", () => {
  it("PATCHes /admin/config with a JSON body and content-type", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ enabled: false }));
    const status = await patchInboundConfig(ENV, { enabled: false });
    expect(status).toMatchObject({ configured: true, enabled: false });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("throws MCP_NOT_CONFIGURED (503) when the server isn't wired", async () => {
    await expect(patchInboundConfig({}, { enabled: true })).rejects.toMatchObject({
      code: "MCP_NOT_CONFIGURED",
      status: 503,
    });
  });
});

describe("getInboundAudit", () => {
  it("returns the entries array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entries: [{ id: 1 }] }));
    expect(await getInboundAudit(ENV, 10)).toEqual({ entries: [{ id: 1 }] });
  });

  it("coerces a missing entries field to an empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
    expect(await getInboundAudit(ENV, 10)).toEqual({ entries: [] });
  });
});

describe("adminFetch error mapping (via public calls)", () => {
  it("passes a 400/422 from the MCP server through as-is", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "bad passphrase" }, 422));
    await expect(patchInboundConfig(ENV, { passphrase: "x" })).rejects.toMatchObject({
      code: "MCP_ADMIN_ERROR",
      status: 422,
    });
  });

  it("reports any other upstream status as a 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    await expect(getInboundStatus(ENV)).rejects.toMatchObject({ code: "MCP_ADMIN_ERROR", status: 503 });
  });

  it("uses a default message when the server body carries no error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(null, 500));
    await expect(getInboundStatus(ENV)).rejects.toMatchObject({ status: 503 });
  });

  it("maps an abort/timeout to MCP_UNREACHABLE", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    await expect(getInboundStatus(ENV)).rejects.toMatchObject({
      code: "MCP_UNREACHABLE",
      status: 503,
    });
  });

  it("maps a network failure to MCP_UNREACHABLE", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(getInboundStatus(ENV)).rejects.toMatchObject({ code: "MCP_UNREACHABLE" });
  });
});
