// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generated / native build output — not source we lint.
    ignores: ["dist/*", ".expo/*", "android/*", "ios/*"],
  },
  {
    // The React-Compiler-era react-hooks rules flag many established, working
    // patterns (accessing a ref during render, setState in an effect). We keep
    // them ON as warnings for visibility, but they don't block CI. Genuine bugs
    // stay as errors.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
