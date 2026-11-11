import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Reuse the plugin INSTANCES that eslint-config-next already registered so we can
// adjust rule severities without re-importing the plugins (a fresh import + a
// second `plugins` registration re-applies their full rule sets to every file
// and floods the run). Same object → ESLint accepts the rule override in-scope.
const nextConfigs = [...nextVitals, ...nextTs];
const pluginInstance = (name) =>
  nextConfigs.find((c) => c?.plugins?.[name])?.plugins?.[name];
const reactHooks = pluginInstance("react-hooks");
const react = pluginInstance("react");
const typescriptEslint = pluginInstance("@typescript-eslint");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build/tooling output — must be ignored or a bare `eslint` (CI) lints the
    // thousands of bundled files under .open-next and OOMs.
    ".open-next/**",
    ".wrangler/**",
    "dist/**",
    "coverage/**",
  ]),
  {
    // The React-Compiler-era rule flags many established, working patterns
    // (setState in an effect). Keep it ON as a warning for visibility (it does
    // not block CI); genuine bugs stay as errors.
    files: ["**/*.{ts,tsx}"],
    plugins: {
      ...(reactHooks ? { "react-hooks": reactHooks } : {}),
      ...(typescriptEslint ? { "@typescript-eslint": typescriptEslint } : {}),
    },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      // Honour the underscore-prefix convention for intentionally-unused
      // identifiers (e.g. `(..._a: unknown[]) => …` in test stubs, caught errors).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Inline wrapper components in test files don't need display names.
    files: ["**/*.test.{ts,tsx}"],
    ...(react ? { plugins: { react } } : {}),
    rules: {
      "react/display-name": "off",
    },
  },
]);

export default eslintConfig;
