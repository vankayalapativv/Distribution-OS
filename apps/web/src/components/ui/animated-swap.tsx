"use client";

/**
 * Cross-fades between content states (e.g. a loading shimmer → the fetched rows)
 * while smoothly easing the container height, so swapping content never snaps the
 * layout. Change `swapKey` whenever the content meaningfully changes; the height
 * is measured (not transform-scaled) so children never distort. Respects
 * prefers-reduced-motion.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AnimatedSwap({
  swapKey,
  children,
  className,
  duration = 0.45,
}: {
  /** Changes when the content should cross-fade to a new state. */
  readonly swapKey: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly duration?: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      transition={{ height: { duration: reduce ? 0 : duration, ease: EASE } }}
      className={cn("relative overflow-hidden", className)}
    >
      <div ref={contentRef}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={swapKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
