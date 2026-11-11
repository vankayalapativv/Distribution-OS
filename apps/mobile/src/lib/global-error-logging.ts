import { reportMobileError } from "./report-error";

/**
 * Log uncaught JS errors and unhandled promise rejections with a grep-able
 * tag so they show up in `adb logcat *:E` on any device — this is how a
 * crash on an unknown phone (Moto, Xiaomi, …) becomes diagnosable. We keep
 * the default handler so the OS still records the crash.
 */
export function installGlobalErrorLogging(): void {
  const g = globalThis as unknown as {
    __distributionOsErrHooked?: boolean;
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  };
  if (g.__distributionOsErrHooked || !g.ErrorUtils) return;
  g.__distributionOsErrHooked = true;

  const previous = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((err, isFatal) => {
    const e = err as Error | undefined;
    console.error(
      `[DistributionOSCrash] ${isFatal ? "FATAL" : "non-fatal"} JS error:`,
      e?.message,
      e?.stack,
    );
    reportMobileError(err, { boundary: "global-handler", fatal: Boolean(isFatal) });
    previous?.(err, isFatal);
  });
}
