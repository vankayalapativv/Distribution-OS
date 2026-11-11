import { describe, expect, it } from "vitest";
import { newMapId, signToken, verifyToken } from "./map-links";

const SECRET = "test-signing-secret-abcdef0123456789";
const future = () => Date.now() + 60_000;

describe("newMapId", () => {
  it("is 32 lowercase hex chars and unguessably unique", () => {
    const a = newMapId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(new Set(Array.from({ length: 50 }, newMapId)).size).toBe(50);
  });
});

describe("signToken / verifyToken", () => {
  it("verifies a fresh, untampered token", async () => {
    const id = newMapId();
    const token = await signToken(id, future(), SECRET);
    expect(await verifyToken(id, token, SECRET)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const id = newMapId();
    const token = await signToken(id, Date.now() - 1, SECRET);
    expect(await verifyToken(id, token, SECRET)).toBe(false);
  });

  it("rejects the wrong secret", async () => {
    const id = newMapId();
    const token = await signToken(id, future(), SECRET);
    expect(await verifyToken(id, token, "another-secret")).toBe(false);
  });

  it("rejects a different id (signature bound to the id)", async () => {
    const token = await signToken(newMapId(), future(), SECRET);
    expect(await verifyToken(newMapId(), token, SECRET)).toBe(false);
  });

  it("rejects a tampered signature (same length)", async () => {
    const id = newMapId();
    const token = await signToken(id, future(), SECRET);
    const flipped = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(await verifyToken(id, flipped, SECRET)).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    const id = newMapId();
    for (const bad of ["", "nodot", ".sig", "abc.sig", `${future()}.`]) {
      expect(await verifyToken(id, bad, SECRET)).toBe(false);
    }
  });
});
