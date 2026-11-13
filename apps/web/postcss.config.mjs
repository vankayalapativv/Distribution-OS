import oklchFallback from "./scripts/postcss-oklch-fallback.mjs";

// Tailwind compiles first, then oklchFallback adds rgb/rgba fallbacks for the
// oklch() + color-mix() it emits, so the app renders on pre-2023 browsers.
const config = {
  plugins: ["@tailwindcss/postcss", oklchFallback()],
};

export default config;
