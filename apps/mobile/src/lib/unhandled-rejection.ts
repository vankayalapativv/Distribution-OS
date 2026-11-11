import { reportMobileError } from "./report-error";

/**
 * Route unhandled promise rejections into the monitor. This app runs on Hermes
 * (the New Architecture requires it), which exposes its own rejection tracker.
 * Best-effort — a missing hook must never break startup, and the global
 * ErrorUtils handler still covers synchronous crashes regardless.
 */
export function installUnhandledRejectionReporting(): void {
  try {
    const hermes = (
      globalThis as {
        HermesInternal?: {
          enablePromiseRejectionTracker?: (opts: {
            allRejections: boolean;
            onUnhandled: (id: number, err: unknown) => void;
            onHandled?: (id: number) => void;
          }) => void;
        };
      }
    ).HermesInternal;
    hermes?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, err) => reportMobileError(err, { boundary: "unhandled-rejection" }),
      onHandled: () => undefined,
    });
  } catch {
    // no tracker available — synchronous crashes are still covered by ErrorUtils
  }
}
