import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the pure offline/sync modules are unit-tested here; they have no
    // React Native imports, so they run in plain Node against node:sqlite.
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      // lcov feeds SonarCloud (Phase 5); text-summary is for the terminal.
      // `include` reports every source file (untested ones show as 0%), so the
      // metric reflects the whole app, not just the pure modules under test.
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
    },
  },
});
