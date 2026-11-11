"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OIL_SEGMENTS } from "./targets-api";

/** The 6 per-segment oil-litre number inputs. */
export function TargetSegmentInputs({
  segments,
  onChange,
}: {
  readonly segments: Record<string, string>;
  readonly onChange: (segment: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {OIL_SEGMENTS.map((segment) => (
        <div key={segment} className="space-y-1">
          <Label htmlFor={`seg-${segment}`} className="text-xs">{segment}</Label>
          <Input
            id={`seg-${segment}`}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={segments[segment]}
            onChange={(e) => onChange(segment, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
