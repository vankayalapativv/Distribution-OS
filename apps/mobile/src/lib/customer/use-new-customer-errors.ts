import { useEffect } from "react";
import type { NewCustomerFields } from "./new-customer";
import { computeCustomerErrors } from "./new-customer-validation";

/**
 * Once errors are shown, clear each field's error as soon as the SE fixes it —
 * never surfacing NEW errors until the next Save press. A no-op while no errors
 * are shown (empty `prev`), and it keeps the same object when nothing changed so
 * the form doesn't re-render needlessly.
 */
export function useAutoClearCustomerErrors(
  v: NewCustomerFields,
  isSuperAdmin: boolean,
  photoCount: number,
  geo: { latitude: number; longitude: number } | null,
  setFieldErrors: (updater: (prev: Record<string, string>) => Record<string, string>) => void,
) {
  useEffect(() => {
    setFieldErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const fresh = computeCustomerErrors(v, isSuperAdmin, photoCount, geo != null);
      const next: Record<string, string> = {};
      for (const key of Object.keys(prev)) if (fresh[key]) next[key] = fresh[key];
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [v, isSuperAdmin, photoCount, geo, setFieldErrors]);
}
