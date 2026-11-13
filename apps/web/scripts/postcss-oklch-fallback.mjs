/**
 * PostCSS plugin — rgb/rgba fallbacks for oklch() and color-mix().
 *
 * Tailwind v4 emits every color as oklch() and every /opacity utility as
 * color-mix(in oklab, …). Browsers older than ~2023 (Chromium < 111, as on
 * Windows 7/8) can't parse either, so colors and translucent fills render
 * wrong or vanish.
 *
 * Approach: for every rule that uses oklch()/color-mix(), emit a sibling
 * `@supports not (color: oklch(0 0 0))` block right after it, holding the same
 * declarations with rgb/rgba values. Old browsers (no oklch → the condition is
 * true) apply the fallback; modern browsers skip the block and keep oklch/
 * color-mix. This survives the Lightning CSS minifier (which strips plain
 * same-property fallbacks but preserves @supports), and it is theme-aware
 * because :root and .dark rules are each processed in place.
 *
 * (oklch and color-mix shipped together — Chromium 111 — so the single oklch
 * feature query is a reliable proxy for "also lacks color-mix".)
 *
 * Limitation: a color-mix fallback resolves its token to the LIGHT value, so a
 * translucent utility in dark mode on a pre-2023 browser can be slightly off.
 */

function oklchToRgb(L, C, H, alpha = 1) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  const to255 = (x) => Math.max(0, Math.min(255, Math.round(gamma(x) * 255)));
  return { r: to255(r), g: to255(g), b: to255(bl), a: alpha };
}

const OKLCH = /oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i;
const OKLCH_G = new RegExp(OKLCH.source, "gi");

const trimNum = (n) => String(Number(n.toFixed(4)));
const rgbStr = ({ r, g, b, a }) => (a < 1 ? `rgba(${r}, ${g}, ${b}, ${trimNum(a)})` : `rgb(${r}, ${g}, ${b})`);

function oklchMatchToRgb(l, c, h, al) {
  const L = l.endsWith("%") ? parseFloat(l) / 100 : parseFloat(l);
  const C = c.endsWith("%") ? (parseFloat(c) / 100) * 0.4 : parseFloat(c);
  const H = parseFloat(h);
  const A = al ? (al.endsWith("%") ? parseFloat(al) / 100 : parseFloat(al)) : 1;
  return oklchToRgb(L, C, H, A);
}

const convertOklch = (value) => value.replace(OKLCH_G, (_m, l, c, h, al) => rgbStr(oklchMatchToRgb(l, c, h, al)));

function hexToRgb(h) {
  let s = h.slice(1);
  if (s.length === 3 || s.length === 4) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s.slice(0, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
}
function rgbFnToRgb(s) {
  const m = s.match(/[\d.]+/g);
  if (!m) return null;
  return { r: +m[0], g: +m[1], b: +m[2], a: m[3] != null ? +m[3] : 1 };
}

/** Resolve a color token (var chains, oklch, hex, rgb, keywords) to rgb, or null. */
function resolveColor(str, map, seen = new Set()) {
  str = str.trim();
  let m;
  if ((m = /^var\(\s*(--[A-Za-z0-9-]+)/.exec(str))) {
    const name = m[1];
    if (seen.has(name)) return null;
    seen.add(name);
    const raw = map[name];
    return raw != null ? resolveColor(raw, map, seen) : null;
  }
  if (OKLCH.test(str)) {
    const mm = OKLCH.exec(str);
    return oklchMatchToRgb(mm[1], mm[2], mm[3], mm[4]);
  }
  if (/^#[0-9a-f]{3,8}$/i.test(str)) return hexToRgb(str);
  if (/^rgba?\(/i.test(str)) return rgbFnToRgb(str);
  if (str === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (str === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (str === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}

/** Replace each balanced color-mix(...) in a value via fn. */
function replaceColorMix(value, fn) {
  let out = "";
  let i = 0;
  const lower = value.toLowerCase();
  while (i < value.length) {
    const idx = lower.indexOf("color-mix(", i);
    if (idx === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, idx);
    let depth = 0;
    let j = idx;
    for (; j < value.length; j++) {
      const ch = value[j];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    out += fn(value.slice(idx, j));
    i = j;
  }
  return out;
}

function colorMixFallback(mix, map) {
  // Opacity form: color-mix(in oklab, COLOR P%, transparent) -> rgba(COLOR, P/100).
  let m = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i.exec(mix);
  if (m) {
    const rgb = resolveColor(m[1], map);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trimNum((parseFloat(m[2]) / 100) * rgb.a)})`;
    return null;
  }
  // Any other mix: degrade to the first resolvable colour.
  m = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(.+?)(?:\s+[\d.]+%)?\s*,/i.exec(mix);
  if (m) {
    const rgb = resolveColor(m[1].replace(/\s+[\d.]+%$/, ""), map);
    if (rgb) return rgbStr(rgb);
  }
  return null;
}

const COLOR_RE = /oklch\(|color-mix\(/i;

/** The rgb/rgba fallback for one declaration value, or null if none is needed. */
function fallbackValue(value, map) {
  let out = value;
  if (/color-mix\(/i.test(out)) {
    let ok = true;
    out = replaceColorMix(out, (mix) => {
      const r = colorMixFallback(mix, map);
      if (r == null) {
        ok = false;
        return mix;
      }
      return r;
    });
    if (!ok) return null;
  }
  if (/oklch\(/i.test(out)) out = convertOklch(out);
  if (out === value || COLOR_RE.test(out)) return null;
  return out;
}

export default function oklchFallback() {
  return {
    postcssPlugin: "oklch-fallback",
    OnceExit(root, { postcss }) {
      // 1. Resolve map from :root / :host custom properties (light values).
      const map = Object.create(null);
      root.walkRules((rule) => {
        const sels = rule.selectors || [];
        if (!sels.some((s) => s.includes(":root") || s.includes(":host"))) return;
        rule.walkDecls((d) => {
          if (d.prop.startsWith("--") && map[d.prop] === undefined) map[d.prop] = d.value;
        });
      });

      // 2. For every colour rule, queue an @supports-not sibling with rgb/rgba.
      const queue = [];
      root.walkRules((rule) => {
        for (let p = rule.parent; p; p = p.parent) {
          if (p.type === "atrule" && p.name === "supports" && /oklch/i.test(p.params)) return;
        }
        const defs = [];
        rule.each((node) => {
          if (node.type !== "decl" || !COLOR_RE.test(node.value)) return;
          const fb = fallbackValue(node.value, map);
          if (fb) defs.push([node.prop, fb]);
        });
        if (defs.length) queue.push([rule, defs]);
      });

      // 3. Insert the fallback blocks (after the walk, so they aren't revisited).
      for (const [rule, defs] of queue) {
        const at = postcss.atRule({ name: "supports", params: "not (color: oklch(0 0 0))" });
        const clone = postcss.rule({ selector: rule.selector });
        for (const [prop, value] of defs) clone.append({ prop, value });
        at.append(clone);
        rule.after(at);
      }
    },
  };
}
oklchFallback.postcss = true;
