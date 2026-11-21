"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { rupeesExact } from "@/lib/format";
import type { ExpenditureSummary } from "./expenditures-api";
import { buildSlices } from "./breakdown-slices";
import { HEIGHT, isTight, layout, share, textColor, type Tile } from "./treemap-layout";

/**
 * Breakdown-by-category treemap: each category is a rectangle sized by its
 * spend, labelled inside, coloured compulsory (blue) / variable (grey). Pure
 * layout — no chart library — so it renders on old browsers too (the colours are
 * inline hex; see treemap-layout). Width is measured from the container, with a
 * window-resize fallback where ResizeObserver is unavailable (pre-2018 browsers).
 */
export default function ExpenditureBreakdownChart({
  summary,
}: {
  readonly summary: ExpenditureSummary;
}) {
  const slices = useMemo(
    () => buildSlices(summary.categories).slice().sort((a, b) => b.amount - a.amount),
    [summary.categories],
  );

  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [node]);

  const tiles = useMemo(() => {
    if (width <= 0 || slices.length === 0) return [];
    const out: Tile[] = [];
    layout(slices, 0, 0, width, HEIGHT, out);
    return out;
  }, [slices, width]);

  return (
    <div>
      <div ref={setNode} className="relative w-full" style={{ height: HEIGHT }}>
        {tiles.map((t) => {
          const pct = share(t.amount, summary.total);
          const tight = isTight(t.w, t.h);
          return (
            <div
              key={t.key}
              title={`${t.name}: ${rupeesExact(t.amount)} (${pct}%)`}
              className="absolute flex flex-col overflow-hidden rounded-[4px] border-2 border-white p-2 transition-opacity hover:opacity-90"
              style={{ left: t.x, top: t.y, width: t.w, height: t.h, backgroundColor: t.fill, color: textColor(t.fill) }}
            >
              <span className={`font-semibold leading-tight ${tight ? "text-[10.5px]" : "text-xs"}`}>{t.name}</span>
              {!tight ? (
                <span className="mt-0.5 text-[11px] opacity-90">
                  {rupeesExact(t.amount)} · {pct}%
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Centred colour key — the type distinction the shades carry. */}
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: "#2563eb" }} /> Compulsory
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: "#64748b" }} /> Variable
        </span>
      </div>
    </div>
  );
}
