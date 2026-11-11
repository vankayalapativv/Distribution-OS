import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MAP_TTL_MS, type StoredMap } from "./maps-do";
import type { VardhanMapSpec } from "./spec";

const spec: VardhanMapSpec = {
  version: "1",
  map: { region: "india" },
  visualization: "choropleth",
  data: [{ key: "Telangana", value: 72 }],
};

const store = () => env.MAPS_DO.get(env.MAPS_DO.idFromName("maps"));

describe("MapsStoreDO (in workerd)", () => {
  it("stores a spec and reads it back with a timestamp", async () => {
    const s = store();
    await s.put("aaaa000011112222", spec);
    const got = await s.get("aaaa000011112222");
    expect(got?.spec).toEqual(spec);
    expect(Number.isNaN(Date.parse(got!.createdAt))).toBe(false);
  });

  it("returns null for an unknown id", async () => {
    expect(await store().get("does-not-exist")).toBeNull();
  });

  it("treats an entry older than the TTL as gone (pruned on read)", async () => {
    const stub = store();
    // Seed an already-expired entry directly in the DO's storage.
    await runInDurableObject(stub, async (_instance, state) => {
      const old: Record<string, StoredMap> = {
        stale: { spec, createdAt: new Date(Date.now() - MAP_TTL_MS - 1000).toISOString() },
      };
      await state.storage.put("maps", old);
    });
    expect(await stub.get("stale")).toBeNull();
  });
});
