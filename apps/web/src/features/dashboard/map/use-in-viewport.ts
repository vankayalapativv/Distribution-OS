import { useEffect, useRef, useState } from "react";

/** Returns a ref + whether that element has entered the viewport. Fires once
 *  (then disconnects) with a `rootMargin` so loading starts just before it
 *  scrolls fully into view — used to defer mounting the heavy Leaflet map. */
export function useInViewport(rootMargin = "200px") {
  const ref = useRef<HTMLDivElement | null>(null);
  // No IntersectionObserver (very old browser) → treat as in-view and just load.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
