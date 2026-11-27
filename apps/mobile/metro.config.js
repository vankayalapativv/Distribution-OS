// Metro config for a pnpm monorepo + NativeWind.
// expo/metro-config detects the workspace root automatically on SDK 57.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Keep co-located test files out of the app bundle. expo-router auto-registers
// EVERY file under `src/app/**` as a route via require.context — including a
// co-located `*.test.tsx` — which would pull vitest/vite into the Metro graph
// and break `expo export`. Block test/spec files from resolution so screen tests
// can live beside their screens (matching the component-folder convention)
// without leaking into the production bundle. (Component tests never hit this —
// only the app/ directory is globbed by the router.)
const blockTests = [/.*\.test\.[jt]sx?$/, /.*\.spec\.[jt]sx?$/];
config.resolver.blockList = Array.isArray(config.resolver.blockList)
  ? [...config.resolver.blockList, ...blockTests]
  : [config.resolver.blockList, ...blockTests].filter(Boolean);

module.exports = withNativeWind(config, { input: "./src/global.css" });
