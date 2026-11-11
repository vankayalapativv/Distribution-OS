import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Integration tests that run INSIDE workerd (Miniflare) so the Durable Objects
 * (MapsStoreDO) and the `/m/<id>` route can be exercised end-to-end against the
 * real `wrangler.jsonc` bindings + migrations. Unit tests stay on the fast node
 * pool (`vitest.config.ts`); these files are named `*.workers.test.ts`.
 */
export default defineWorkersConfig({
  test: {
    include: ["src/**/*.workers.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // MAP_SIGNING_SECRET is a Worker secret (not in wrangler.jsonc); supply
          // a deterministic one for tests. PUBLIC_ORIGIN comes from wrangler vars.
          bindings: { MAP_SIGNING_SECRET: "test-map-signing-secret-0123456789abcdef" },
        },
      },
    },
  },
});
