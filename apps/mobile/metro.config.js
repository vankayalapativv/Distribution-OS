// Metro config for a pnpm monorepo + NativeWind.
// expo/metro-config detects the workspace root automatically on SDK 57.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
