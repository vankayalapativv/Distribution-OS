#!/usr/bin/env node
/**
 * Import-cycle fitness function (architecture audit G-0202). Fails (exit 1) if any
 * intra-package import cycle exists. Resolver-independent (no eslint/TS-API
 * dependency), so it works with the repo's bleeding-edge TypeScript. This is what
 * caught G-0101; keeping it in CI stops that class of coupling from returning.
 *
 * Usage: node scripts/check-cycles.mjs [dir ...]   (default: apps/api/src)
 */
import fs from "node:fs";
import path from "node:path";

const roots = (process.argv.slice(2).length ? process.argv.slice(2) : ["apps/api/src"]).map((d) =>
  path.resolve(d),
);
const exts = [".ts", ".tsx", ".js", ".jsx"];
const skip = new Set(["node_modules", ".next", "dist", "build", ".expo", ".turbo", ".wrangler", ".open-next", "coverage"]);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (exts.includes(path.extname(e.name)) && !e.name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

const files = roots.flatMap((r) => walk(r));
const set = new Set(files);
const importRe = /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm;

function resolveRel(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base, base + ".ts", base + ".tsx", base + ".js", base + ".jsx", path.join(base, "index.ts"), path.join(base, "index.tsx"), path.join(base, "index.js")];
  for (const c of cands) if (set.has(c)) return c;
  return null;
}

const edges = new Map(files.map((f) => [f, new Set()]));
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(src))) {
    const dep = resolveRel(f, m[1]);
    if (dep && dep !== f) edges.get(f).add(dep);
  }
}

// Tarjan SCC — any component of size > 1 is a cycle.
let idx = 0;
const index = new Map(), low = new Map(), onstack = new Set(), stack = [], cycles = [];
function sc(v) {
  index.set(v, idx); low.set(v, idx); idx++; stack.push(v); onstack.add(v);
  for (const w of edges.get(v)) {
    if (!index.has(w)) { sc(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (onstack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
  }
  if (low.get(v) === index.get(v)) {
    const comp = []; let w;
    do { w = stack.pop(); onstack.delete(w); comp.push(w); } while (w !== v);
    if (comp.length > 1) cycles.push(comp.map((f) => path.relative(process.cwd(), f)));
  }
}
for (const f of files) if (!index.has(f)) sc(f);

if (cycles.length > 0) {
  console.error(`✖ ${cycles.length} import cycle(s) found:`);
  for (const c of cycles) console.error("  " + c.join(" -> "));
  process.exit(1);
}
console.log(`✓ No import cycles across ${files.length} files in ${roots.map((r) => path.relative(process.cwd(), r)).join(", ")}.`);
