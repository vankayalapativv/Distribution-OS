import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Override the project's file-based PostCSS config with an empty inline one.
  // Components (e.g. tracking-map) import vendor CSS (leaflet / maplibre-gl);
  // processing it would make Vite load postcss.config.mjs, whose string
  // "@tailwindcss/postcss" plugin the bare PostCSS loader can't resolve
  // ("Invalid PostCSS Plugin"). jsdom never applies styles, so an empty
  // pipeline is correct for tests.
  css: { postcss: { plugins: [] } },
  resolve: {
    // Mirror the tsconfig "@/*" -> "./src/*" path alias so component imports
    // (e.g. "@/components/ui/breadcrumb") resolve under vitest too.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The Next.js "server-only" marker package has no resolvable module under
      // vitest; stub it so server-utility modules can be imported in tests.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      // lcov feeds SonarCloud (Phase 5); text-summary is for the terminal.
      // istanbul (not v8) — v8's bytecode instrumentation drops the jsdom
      // jest-dom matcher extension across the full suite; istanbul's babel
      // transform leaves `expect` untouched.
      provider: "istanbul",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts", "src/test/**"],
    },
  },
});
