import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Set up ONE shared miniflare for `next dev` so getCloudflareContext() reuses a
// single Cloudflare bindings proxy. Without this, each getCloudflareContext()
// call (server-api.ts) spins up its own miniflare, and because Next renders
// routes concurrently, several workerd end up racing on the same
// .wrangler/state cache SQLite — the SQLITE_BUSY / SQLITE_READONLY crashes seen
// at startup. Must be called from the Next config; it no-ops outside `next dev`,
// so it's inert for `next build` / production. Async, but need not be awaited.
void initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // The `/dashboard` URL prefix was removed (pages moved into a route group and
  // now sit at the root, e.g. /customers). These redirects keep old
  // `/dashboard/...` bookmarks working. Specific rules come first; the generic
  // catch-all handles the rest. Not permanent (307) during rollout.
  async redirects() {
    return [
      { source: "/dashboard/super-admin/setup", destination: "/settings/users", permanent: false },
      { source: "/dashboard/super-admin", destination: "/", permanent: false },
      { source: "/dashboard/manager", destination: "/", permanent: false },
      { source: "/dashboard/accountant", destination: "/", permanent: false },
      { source: "/dashboard", destination: "/", permanent: false },
      { source: "/dashboard/:path*", destination: "/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
