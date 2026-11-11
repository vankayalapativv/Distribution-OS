/// <reference types="@cloudflare/vitest-pool-workers" />

declare module "cloudflare:test" {
  // The Worker's env (bindings from wrangler.jsonc + the test-provided secret).
  interface ProvidedEnv extends Env {}
}
