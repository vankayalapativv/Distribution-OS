"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * A persistent strip that appears when the browser reports it's offline, so the
 * office knows why pages stop loading (rather than blaming a generic "couldn't
 * load"). The web app is online-only — there's no queue — so it also warns that
 * changes won't save. Renders nothing while online (no layout shift).
 */
export function ConnectivityBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-amber-600/30 bg-amber-500 px-4 py-1.5 text-center text-[13px] font-medium text-white"
    >
      <WifiOff className="size-4 shrink-0" />
      You appear to be offline — pages won&apos;t load and changes won&apos;t save until you reconnect.
    </div>
  );
}
