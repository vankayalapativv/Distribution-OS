import { describe, expect, test } from "vitest";
import { checkInFence, distanceMeters } from "./geo";

// Khammam-area reference points (the trial's real geography).
const SHOP = { latitude: 17.2473, longitude: 80.1514 };

describe("distanceMeters", () => {
  test("zero for identical points", () => {
    expect(distanceMeters(SHOP.latitude, SHOP.longitude, SHOP.latitude, SHOP.longitude)).toBe(0);
  });

  test("~111 m for 0.001° of latitude", () => {
    const d = distanceMeters(SHOP.latitude, SHOP.longitude, SHOP.latitude + 0.001, SHOP.longitude);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });

  test("kilometre-scale distances are sane", () => {
    // ~0.01° lat ≈ 1.11 km
    const d = distanceMeters(SHOP.latitude, SHOP.longitude, SHOP.latitude + 0.01, SHOP.longitude);
    expect(d).toBeGreaterThan(1050);
    expect(d).toBeLessThan(1170);
  });
});

describe("checkInFence", () => {
  test("allows at the shop", () => {
    const r = checkInFence({ ...SHOP, accuracy: 10 }, SHOP);
    expect(r.allowed).toBe(true);
    expect(r.distanceM).toBe(0);
  });

  test("allows just inside 100 m", () => {
    const r = checkInFence(
      { latitude: SHOP.latitude + 0.0008, longitude: SHOP.longitude, accuracy: 0 },
      SHOP,
    );
    expect(r.distanceM).toBeLessThanOrEqual(100);
    expect(r.allowed).toBe(true);
  });

  test("blocks well outside 100 m", () => {
    const r = checkInFence(
      { latitude: SHOP.latitude + 0.003, longitude: SHOP.longitude, accuracy: 10 },
      SHOP,
    );
    expect(r.distanceM).toBeGreaterThan(300);
    expect(r.allowed).toBe(false);
  });

  test("a weak GPS fix at the shop is forgiven (distance − accuracy)", () => {
    // 140 m raw distance but ±50 m accuracy → effective 90 m → allowed.
    const r = checkInFence(
      { latitude: SHOP.latitude + 0.00126, longitude: SHOP.longitude, accuracy: 50 },
      SHOP,
    );
    expect(r.distanceM).toBeGreaterThan(100);
    expect(r.allowed).toBe(true);
  });

  test("missing accuracy is treated as exact", () => {
    const r = checkInFence(
      { latitude: SHOP.latitude + 0.002, longitude: SHOP.longitude, accuracy: null },
      SHOP,
    );
    expect(r.allowed).toBe(false);
  });
});
