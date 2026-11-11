import { describe, expect, it } from "vitest";
import { describeDevice, sessionLabel } from "./super-admin-user-sessions";

describe("describeDevice", () => {
  it("returns a fallback for a missing user-agent", () => {
    expect(describeDevice(null)).toBe("Unknown device");
    expect(describeDevice("")).toBe("Unknown device");
  });

  it("names browser + OS from a Chrome-on-Windows UA", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(describeDevice(ua)).toBe("Chrome on Windows");
  });

  it("prefers Edge over Chrome when both tokens are present", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edg/120.0.0.0";
    expect(describeDevice(ua)).toBe("Edge on Windows");
  });

  it("prefers Opera over Chrome", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120 Safari/537.36 OPR/106.0.0.0";
    expect(describeDevice(ua)).toBe("Opera on macOS");
  });

  it("detects Safari on iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(describeDevice(ua)).toBe("Safari on iOS");
  });

  it("detects Firefox on Linux", () => {
    expect(describeDevice("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0")).toBe(
      "Firefox on Linux",
    );
  });

  it("detects Chrome on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    // Android token wins over the generic Linux token in a mobile UA.
    expect(describeDevice(ua)).toBe("Chrome on Android");
  });

  it("falls back to the browser alone when the OS is unrecognised", () => {
    expect(describeDevice("Chrome/120 on SomeUnknownOS")).toBe("Chrome");
  });

  it("labels our own clients: OkHttp → mobile app, node/undici → web app", () => {
    expect(describeDevice("okhttp/4.12.0")).toBe("Mobile app (Android)");
    expect(describeDevice("node")).toBe("Web app");
    expect(describeDevice("undici")).toBe("Web app");
  });

  it("names the phone from the Expo app's device string", () => {
    expect(describeDevice("SriAparajita/1.1.2 (Android 13; samsung; SM-G991B)")).toBe("Samsung SM-G991B");
    // model already carrying the brand isn't doubled up
    expect(describeDevice("SriAparajita/1.1.2 (Android 14; Google; Pixel 8)")).toBe("Google Pixel 8");
    // unknown manufacturer → model alone
    expect(describeDevice("SriAparajita/1.1.2 (Android 12; Unknown; Redmi Note 10)")).toBe("Redmi Note 10");
  });

  it("returns a generic Browser label when nothing matches", () => {
    expect(describeDevice("curl/8.4.0")).toBe("Browser");
  });
});

describe("sessionLabel", () => {
  it("adds the device model to a mobile session when known", () => {
    expect(sessionLabel("okhttp/4.12.0", "Samsung SM-G991B")).toBe("Mobile app · Samsung SM-G991B");
  });
  it("falls back to the plain label without a model, or for non-mobile UAs", () => {
    expect(sessionLabel("okhttp/4.12.0", null)).toBe("Mobile app (Android)");
    expect(sessionLabel("node", "Samsung SM-G991B")).toBe("Web app");
    expect(sessionLabel(null, "Samsung SM-G991B")).toBe("Unknown device");
  });
});
