import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadInvoicePdf, shareInvoiceFile, shareInvoicePdf } from "./invoice-pdf";

const expoFetch = vi.fn();
const isAvailableAsync = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const shareAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
let token: string | null = "tok";

const h = vi.hoisted(() => {
  const dirState = { exists: false };
  const destState = { exists: false };
  const createSpy = vi.fn();
  const deleteSpy = vi.fn();
  const writeSpy = vi.fn();
  class Directory {
    dirName: string;
    constructor(_b: unknown, name: string) { this.dirName = name; }
    get exists() { return dirState.exists; }
    create(...a: unknown[]) { createSpy(...a); }
  }
  class File {
    uri: string;
    constructor(a: Directory | string, b?: string) { this.uri = b !== undefined ? `doc/${(a as Directory).dirName}/${b}` : (a as string); }
    get exists() { return destState.exists; }
    delete() { deleteSpy(); }
    write(bytes: unknown) { writeSpy(bytes); }
  }
  return { dirState, destState, createSpy, deleteSpy, writeSpy, Directory, File };
});

vi.mock("expo/fetch", () => ({ fetch: (...a: unknown[]) => expoFetch(...a) }));
vi.mock("expo-file-system", () => ({ Directory: h.Directory, File: h.File, Paths: { document: "doc" } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: () => isAvailableAsync(), shareAsync: (...a: unknown[]) => shareAsync(...a) }));
vi.mock("./api", () => ({ API_BASE_URL: "http://api" }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));


const okPdf = () => ({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
beforeEach(() => {
  token = "tok";
  h.dirState.exists = false; h.destState.exists = false;
  expoFetch.mockResolvedValue(okPdf());
  isAvailableAsync.mockResolvedValue(true);
  shareAsync.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("downloadInvoicePdf", () => {
  it("returns null when signed out", async () => {
    token = null;
    expect(await downloadInvoicePdf("inv1", "INV-1")).toBeNull();
  });
  it("writes the pdf and returns its uri (creating the dir, sanitising the name)", async () => {
    const uri = await downloadInvoicePdf("inv1", "INV/001");
    expect(expoFetch).toHaveBeenCalledWith("http://api/invoice-files/inv1", expect.objectContaining({ headers: { Authorization: "Bearer tok" } }));
    expect(h.createSpy).toHaveBeenCalled();
    expect(h.writeSpy).toHaveBeenCalled();
    expect(uri).toBe("doc/invoices/INV_001.pdf");
  });
  it("overwrites an existing file and falls back to 'invoice' for a blank label", async () => {
    h.dirState.exists = true; h.destState.exists = true;
    const uri = await downloadInvoicePdf("inv1", "");
    expect(h.createSpy).not.toHaveBeenCalled();
    expect(h.deleteSpy).toHaveBeenCalled();
    expect(uri).toBe("doc/invoices/invoice.pdf");
  });
  it("returns null on a non-ok response", async () => {
    expoFetch.mockResolvedValue({ ok: false });
    expect(await downloadInvoicePdf("inv1", "INV-1")).toBeNull();
  });
  it("returns null when the download throws", async () => {
    expoFetch.mockRejectedValue(new Error("timeout"));
    expect(await downloadInvoicePdf("inv1", "INV-1")).toBeNull();
  });
  it("aborts a stalled download after 30s and returns null", async () => {
    vi.useFakeTimers();
    expoFetch.mockImplementation((_url: string, opts: { signal: AbortSignal }) =>
      new Promise((_res, rej) => { opts.signal.addEventListener("abort", () => rej(new Error("aborted"))); }),
    );
    const p = downloadInvoicePdf("inv1", "INV-1");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toBeNull();
    vi.useRealTimers();
  });
});

describe("shareInvoiceFile", () => {
  it("opens the share sheet when available", async () => {
    expect(await shareInvoiceFile("file://a.pdf", "INV-1")).toBe(true);
    expect(shareAsync).toHaveBeenCalledWith("file://a.pdf", expect.objectContaining({ mimeType: "application/pdf" }));
  });
  it("returns false when sharing is unavailable", async () => {
    isAvailableAsync.mockResolvedValue(false);
    expect(await shareInvoiceFile("file://a.pdf", "INV-1")).toBe(false);
  });
  it("returns false when sharing throws", async () => {
    shareAsync.mockRejectedValue(new Error("no handler"));
    expect(await shareInvoiceFile("file://a.pdf", "INV-1")).toBe(false);
  });
});

describe("shareInvoicePdf", () => {
  it("downloads then shares", async () => {
    expect(await shareInvoicePdf("inv1", "INV-1")).toBe(true);
    expect(shareAsync).toHaveBeenCalled();
  });
  it("returns false when the download fails", async () => {
    token = null; // download returns null
    expect(await shareInvoicePdf("inv1", "INV-1")).toBe(false);
    expect(shareAsync).not.toHaveBeenCalled();
  });
});
