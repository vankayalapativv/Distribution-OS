// maplibre-gl v6 loads its render worker as an ESM module chunk
// (`maplibre-gl-worker.mjs`, which itself imports the sibling
// `maplibre-gl-shared.mjs`). OpenNext/Cloudflare and Turbopack do NOT serve
// that chunk from node_modules, so the worker 404s → the vector basemap never
// paints (grey map). We self-host both files from `public/` and point maplibre
// at them via `setWorkerUrl("/maplibre-gl-worker.mjs")` (see lib/basemap.ts and
// the tracking map's `workerUrl` prop).
//
// Copy them here — regenerated from the INSTALLED maplibre-gl on every dev/build
// so they can never drift out of sync with the package version. Run by the
// `predev` / `prebuild` npm hooks.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
// Resolve maplibre-gl's dist dir from wherever pnpm installed it.
const distDir = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));

mkdirSync(publicDir, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(distDir, file), join(publicDir, file));
}
console.log("[copy-maplibre-worker] copied worker + shared chunk to public/");
