import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // lcov feeds SonarCloud; text-summary is for the terminal. No local
      // threshold gate — coverage is tracked in SonarCloud (Phase 5).
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/types.ts",
        // Test-only harness (the SQL mock), not production code.
        "src/test/**",
        // Worker entry + cron/scheduled handler — integration surface, not unit
        // code (excluded from the coverage target per Phase 5 decision).
        "src/index.ts",
      ],
    },
  },
});
