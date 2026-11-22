"use client";

import { Fragment } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The three guided steps, in order. */
export const WIZARD_STEPS = ["Details", "Classification", "Pack sizes"] as const;

/** Horizontal progress rail: a numbered dot + label per step, a rule between. */
export function StepRail({ step }: Readonly<{ step: number }>) {
  return (
    <div className="flex flex-none items-center border-b border-border px-6 py-3.5" aria-hidden="true">
      {WIZARD_STEPS.map((label, i) => (
        <Fragment key={label}>
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "grid size-7 flex-none place-items-center rounded-full border-[1.5px] text-xs font-semibold transition-colors",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary bg-primary/10 text-primary",
                i > step && "border-border bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <CheckIcon className="size-3.5" /> : i + 1}
            </div>
            <span className={cn("hidden whitespace-nowrap text-xs font-medium sm:inline", i <= step ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div className={cn("mx-3 h-px flex-1 rounded", i < step ? "bg-primary" : "bg-border")} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
