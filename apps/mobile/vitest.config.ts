import { defineConfig } from "vitest/config";

/**
 * Two test projects share one coverage report:
 *
 *  - `logic`      — pure offline/sync/business modules (`*.test.ts`). No React
 *                   Native imports, so they run in plain Node against
 *                   node:sqlite. Fast, no DOM.
 *  - `components` — screen + component render tests (`*.test.tsx`). React
 *                   Native is aliased to `react-native-web` so components
 *                   render to a jsdom DOM and `@testing-library/react` can
 *                   drive them; the native-only modules are stubbed in
 *                   `src/test/setup-dom.ts`.
 *
 * Coverage `include` spans every source file (untested files show as 0%), so
 * the metric reflects the whole app, not just the files under test. lcov feeds
 * SonarCloud; text-summary is for the terminal.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.test-support.ts",
        "src/**/*.d.ts",
        "src/test/**",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "logic",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        resolve: {
          alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
        },
        test: {
          name: "components",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["src/test/setup-dom.ts"],
        },
      },
    ],
  },
});
