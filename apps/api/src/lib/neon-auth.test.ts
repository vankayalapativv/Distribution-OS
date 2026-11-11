import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyNeonToken } from "./neon-auth";

const JWKS_URL = "https://jwks.test/keys";
const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const token = (header: object, payload: object, sig = "AAAA") => `${b64url(header)}.${b64url(payload)}.${sig}`;
const future = Math.floor(Date.now() / 1000) + 3600;

function mockJwks() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ keys: [{ kty: "OKP", crv: "Ed25519", x: "AAAA", kid: "k1" }] }),
  } as unknown as Response);
}
function mockVerify(result: boolean) {
  vi.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey);
  vi.spyOn(crypto.subtle, "verify").mockResolvedValue(result);
}

afterEach(() => vi.restoreAllMocks());

describe("verifyNeonToken", () => {
  it("rejects a malformed token (missing parts)", async () => {
    await expect(verifyNeonToken("abc", JWKS_URL)).rejects.toMatchObject({ code: "INVALID_AUTH_TOKEN", status: 401 });
  });

  it("rejects an unsupported algorithm", async () => {
    await expect(verifyNeonToken(token({ alg: "HS256", kid: "k1" }, { sub: "u" }), JWKS_URL)).rejects.toThrow(/unsupported algorithm/);
  });

  it("rejects an invalid signature", async () => {
    mockJwks();
    mockVerify(false);
    await expect(verifyNeonToken(token({ alg: "EdDSA", kid: "k1" }, { sub: "u", exp: future }), JWKS_URL)).rejects.toThrow(/signature is invalid/);
  });

  it("rejects a token with no subject", async () => {
    mockJwks();
    mockVerify(true);
    await expect(verifyNeonToken(token({ alg: "EdDSA", kid: "k1" }, { exp: future }), JWKS_URL)).rejects.toThrow(/identity is incomplete/);
  });

  it("rejects an expired token", async () => {
    mockJwks();
    mockVerify(true);
    await expect(verifyNeonToken(token({ alg: "EdDSA", kid: "k1" }, { sub: "u", exp: 1 }), JWKS_URL)).rejects.toThrow(/expired/);
  });

  it("rejects a not-yet-active token (nbf in the future)", async () => {
    mockJwks();
    mockVerify(true);
    await expect(
      verifyNeonToken(token({ alg: "EdDSA", kid: "k1" }, { sub: "u", exp: future, nbf: future }), JWKS_URL),
    ).rejects.toThrow(/not active yet/);
  });

  it("verifies a valid token and returns subject + email", async () => {
    mockJwks();
    mockVerify(true);
    const res = await verifyNeonToken(token({ alg: "EdDSA", kid: "k1" }, { sub: "u1", email: "a@b.c", exp: future }), JWKS_URL);
    expect(res).toEqual({ subject: "u1", email: "a@b.c" });
  });

  it("defaults email to null when the claim is absent", async () => {
    mockVerify(true); // key is now cached from the previous test
    const res = await verifyNeonToken(token({ alg: "EdDSA", kid: "k1" }, { sub: "u2", exp: future }), JWKS_URL);
    expect(res).toEqual({ subject: "u2", email: null });
  });
});
