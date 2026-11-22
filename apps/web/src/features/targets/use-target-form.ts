"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { OIL_SEGMENTS, segLitres, type ExecutiveTargets, type TargetPeriod } from "./targets-api";

const asRecord = (get: (s: string) => number) =>
  Object.fromEntries(OIL_SEGMENTS.map((s) => [s, String(get(s) || "")]));
const asNumbers = (segments: Record<string, string>) =>
  Object.fromEntries(OIL_SEGMENTS.map((s) => [s, Math.max(0, Number(segments[s]) || 0)]));

/** Form state + save mutation for one SE's period target (oil segments). The
 *  form seeds from the SE's effective target, so editing an inherited (carried-
 *  forward) period starts from its current values. */
export function useTargetForm(
  actionConfig: ActionConfig,
  executive: ExecutiveTargets,
  period: TargetPeriod,
  periodStart: string,
  onClose: () => void,
) {
  const queryClient = useQueryClient();
  const [segments, setSegments] = useState<Record<string, string>>(() =>
    asRecord((s) => segLitres(executive.perf.oilTarget, s)),
  );
  const [error, setError] = useState<string | null>(null);

  const setSegment = (segment: string, value: string) => setSegments((v) => ({ ...v, [segment]: value }));

  const save = useMutation({
    mutationFn: () =>
      apiRequest(actionConfig, "PUT", `/targets/${executive.userId}`, {
        periodType: period,
        periodDate: periodStart,
        segments: asNumbers(segments),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["se-targets"] });
      onClose();
    },
    onError: (e) => setError(errorMessage(e, "Could not save the target.")),
  });

  return { segments, setSegment, error, save };
}
