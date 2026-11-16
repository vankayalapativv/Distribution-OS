import { afterEach, describe, expect, it, vi } from "vitest";
import { arrayBufferToBase64, sendEmail } from "./email";

const ENV = { RESEND_API_KEY: "re_test", ALERT_FROM: "A <a@x.in>" } as never;

afterEach(() => vi.restoreAllMocks());

describe("sendEmail", () => {
  it("returns false (no send) when RESEND_API_KEY is unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await sendEmail({} as never, { to: "x@y.in", subject: "s", html: "<p>h</p>" })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs to Resend with the attachment and normalises a single recipient to an array", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const ok = await sendEmail(ENV, {
      to: "ca@firm.in", subject: "GSTR-1", html: "<p>h</p>",
      attachments: [{ filename: "GSTR1.xlsx", content: "B64" }],
    });
    expect(ok).toBe(true);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(["ca@firm.in"]);
    expect(body.from).toBe("A <a@x.in>");
    expect(body.attachments).toEqual([{ filename: "GSTR1.xlsx", content: "B64" }]);
  });

  it("returns false on a non-2xx from Resend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 422 }));
    expect(await sendEmail(ENV, { to: "x@y.in", subject: "s", html: "h" })).toBe(false);
  });
});

describe("arrayBufferToBase64", () => {
  it("round-trips bytes through base64", () => {
    const bytes = new Uint8Array([72, 105, 33]); // "Hi!"
    expect(arrayBufferToBase64(bytes.buffer)).toBe(btoa("Hi!"));
  });

  it("handles a buffer larger than one chunk without overflowing", () => {
    const big = new Uint8Array(0x8000 * 2 + 5).fill(65);
    const b64 = arrayBufferToBase64(big.buffer);
    expect(atob(b64).length).toBe(big.length);
  });
});
