import { describe, expect, it } from "vitest";
import { generateMcpPassphrase, getMcpPassphraseStatus, setMcpEnabled } from "./mcp-passphrase";
import { makeSql, calledTag } from "../test/sql-mock";

describe("getMcpPassphraseStatus", () => {
  it("returns disabled defaults when no row exists", async () => {
    const out = await getMcpPassphraseStatus(makeSql({ mcp_passphrase_status: [] }));
    expect(out).toEqual({ enabled: false, passphraseSet: false, passphraseSetAt: null, updatedAt: null });
  });

  it("maps a row (Date → ISO)", async () => {
    const when = new Date("2026-11-11T00:00:00Z");
    const out = await getMcpPassphraseStatus(
      makeSql({ mcp_passphrase_status: [{ enabled: true, passphraseSet: true, passphraseSetAt: when, updatedAt: when }] }),
    );
    expect(out).toMatchObject({ enabled: true, passphraseSet: true });
    expect(out.passphraseSetAt).toBe("2026-11-11T00:00:00.000Z");
  });
});

describe("generateMcpPassphrase", () => {
  it("returns a readable high-entropy plaintext ONCE and upserts the hash", async () => {
    const sql = makeSql({ mcp_passphrase_upsert: [] });
    const { passphrase } = await generateMcpPassphrase(sql, "u1");
    expect(passphrase).toMatch(/^mcp_[0-9A-HJ-NP-TV-Z]{8}-[0-9A-HJ-NP-TV-Z]{8}-[0-9A-HJ-NP-TV-Z]{8}$/);
    expect(calledTag(sql, "mcp_passphrase_upsert")).toBe(true);
    // Two calls produce different secrets (crypto RNG).
    const again = await generateMcpPassphrase(sql, "u1");
    expect(again.passphrase).not.toBe(passphrase);
  });
});

describe("setMcpEnabled", () => {
  it("409s when no passphrase row was updated", async () => {
    await expect(setMcpEnabled(makeSql({ mcp_passphrase_set_enabled: [] }), false, "u1")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("returns the fresh status after toggling", async () => {
    const sql = makeSql({
      mcp_passphrase_set_enabled: [{ enabled: false }],
      mcp_passphrase_status: [{ enabled: false, passphraseSet: true, passphraseSetAt: null, updatedAt: null }],
    });
    const out = await setMcpEnabled(sql, false, "u1");
    expect(out).toMatchObject({ enabled: false, passphraseSet: true });
  });
});
