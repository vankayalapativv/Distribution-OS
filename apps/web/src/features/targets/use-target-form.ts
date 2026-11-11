"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { OIL_SEGMENTS, segLitres, type ExecutiveTargets, type TargetPeriod, type TargetValues } from "./targets-api";

const asRecord = (get: (s: string) => number) =>
  Object.fromEntries(OIL_SEGMENTS.map((s) => [s, String(get(s) || "")]));
const asNumbers = (segments: Record<string, string>) =>
  Object.fromEntries(OIL_SEGMENTS.map((s) => [s, Math.max(0, Number(segments[s]) || 0)]));

/** Form state + save mutation for one SE's period target (oil segments). */
export function useTargetForm(
  actionConfig: ActionConfig,
  executive: ExecutiveTargets,
  period: TargetPeriod,
  periodStart: string,
  onCopy: (values: TargetValues) => void,
  onClose: () => void,
) {
  const queryClient = useQueryClient();
  const current = executive.perf;
  const [segments, setSegments] = useState<Record<string, string>>(() =>
    asRecord((s) => segLitres(current.oilTarget, s)),
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyable = executive.currentTarget;
  const setSegment = (segment: string, value: string) => setSegments((v) => ({ ...v, [segment]: value }));
  const formValues = (): TargetValues => ({ oil: asNumbers(segments) });
  const fillFrom = (values: TargetValues) => {
    setSegments(asRecord((s) => values.oil[s]));
  };
  const copyFromCurrent = () => copyable && fillFrom({ oil: Object.fromEntries(OIL_SEGMENTS.map((s) => [s, segLitres(copyable.oil, s)])) });
  const handleCopy = () => {
    onCopy(formValues());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

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

  return { segments, setSegment, error, copied, copyable, copyFromCurrent, handleCopy, fillFrom, save };
}
