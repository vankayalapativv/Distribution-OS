import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { newMapId, signToken } from "./map-links";
import type { VardhanMapSpec } from "./spec";

// Must match the MAP_SIGNING_SECRET binding in vitest.workers.config.ts.
const SECRET = "test-map-signing-secret-0123456789abcdef";

const spec: VardhanMapSpec = {
  version: "1",
  map: { region: "state", state: "Telangana" },
  visualization: "choropleth",
  data: [{ key: "Khammam", value: 42 }],
  options: { title: "Sales by district" },
};

/** Store a spec the way render_map does; return its id. */
async function seed(): Promise<string> {
  const id = newMapId();
  await env.MAPS_DO.get(env.MAPS_DO.idFromName("maps")).put(id, spec);
  return id;
}
const link = async (id: string, exp = Date.now() + 60_000) =>
  `https://mcp.test/m/${id}?t=${await signToken(id, exp, SECRET)}`;

describe("GET /m/<id> (end-to-end through the Worker)", () => {
  it("serves the interactive page for a valid, stored, signed link", async () => {
    const id = await seed();
    const res = await SELF.fetch(await link(id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Khammam"); // the embedded spec
    expect(html).toContain("vardhan-maps@0.17.0/react"); // the published renderer
  });

  it("403s with no token", async () => {
    const id = await seed();
    expect((await SELF.fetch(`https://mcp.test/m/${id}`)).status).toBe(403);
  });

  it("403s a tampered token", async () => {
    const id = await seed();
    const url = await link(id);
    const bad = url.slice(0, -1) + (url.at(-1) === "a" ? "b" : "a");
    expect((await SELF.fetch(bad)).status).toBe(403);
  });

  it("403s an expired token", async () => {
    const id = await seed();
    expect((await SELF.fetch(await link(id, Date.now() - 1000))).status).toBe(403);
  });

  it("404s a validly-signed id that was never stored", async () => {
    const id = newMapId();
    expect((await SELF.fetch(await link(id))).status).toBe(404);
  });

  it("405s a non-GET method", async () => {
    const id = await seed();
    expect((await SELF.fetch(await link(id), { method: "POST" })).status).toBe(405);
  });

  it("falls through to the OAuth gate for non-map paths (not our 403)", async () => {
    const res = await SELF.fetch("https://mcp.test/mcp");
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(401); // OAuth challenge, unchanged by the map route
  });
});
