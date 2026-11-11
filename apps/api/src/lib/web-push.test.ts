import { afterEach, describe, expect, it, vi } from "vitest";
import { b64urlDecode, b64urlEncode, encryptPayload, sendWebPush, vapidJwt } from "./web-push";

// RFC 8291 Appendix A — the canonical Web Push encryption test vector.
const RFC8291 = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  expected:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("web-push encryption — RFC 8291 test vector", () => {
  it("reproduces the RFC 8291 Appendix A encrypted body exactly", async () => {
    const body = await encryptPayload(
      b64urlDecode(RFC8291.plaintext),
      b64urlDecode(RFC8291.uaPublic),
      b64urlDecode(RFC8291.authSecret),
      {
        asPrivate: b64urlDecode(RFC8291.asPrivate),
        asPublic: b64urlDecode(RFC8291.asPublic),
        salt: b64urlDecode(RFC8291.salt),
      },
    );
    expect(b64urlEncode(body)).toBe(RFC8291.expected);
  });

  it("base64url round-trips", () => {
    const bytes = b64urlDecode(RFC8291.salt);
    expect(bytes).toHaveLength(16);
    expect(b64urlEncode(bytes)).toBe(RFC8291.salt);
  });
});

describe("VAPID JWT", () => {
  it("produces a well-formed ES256 JWT with the right claims", async () => {
    // A throwaway P-256 key pair (public point + private scalar), base64url.
    const jwt = await vapidJwt(
      "https://fcm.googleapis.com",
      {
        publicKey: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
        privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
        subject: "mailto:ops@sri-aparajita.local",
      },
      1_700_000_000,
    );
    const [header, payload, sig] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(header)))).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:ops@sri-aparajita.local");
    expect(claims.exp).toBe(1_700_000_000 + 12 * 60 * 60);
    expect(b64urlDecode(sig)).toHaveLength(64); // ES256 raw r||s
  });
});

describe("sendWebPush request shape", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs to the endpoint with VAPID auth + aes128gcm body", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(null, { status: 201 });
    });

    const res = await sendWebPush(
      {
        endpoint: "https://push.example.com/abc123",
        p256dh: RFC8291.uaPublic,
        auth: RFC8291.authSecret,
      },
      { title: "New collection", body: "₹3,000 from Test Shop", tag: "sri-aparajita-collection" },
      {
        publicKey: RFC8291.asPublic,
        privateKey: RFC8291.asPrivate,
        subject: "mailto:ops@sri-aparajita.local",
      },
      1_700_000_000,
    );

    expect(res.status).toBe(201);
    expect(captured).not.toBeNull();
    const { url, init } = captured!;
    expect(url).toBe("https://push.example.com/abc123");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBeTruthy();
    expect(headers.Authorization).toMatch(/^vapid t=.+,k=.+$/);
    expect((init.body as Uint8Array).byteLength).toBeGreaterThan(80);
  });
});
