"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Alert } from "./alerts-api";
import { ALERT_TYPE_LABELS, SEVERITY_CLASSES } from "./alerts-helpers";

interface AlertCardProps {
  readonly alert: Alert;
  readonly closing: boolean;
  readonly onClose: (id: string) => void;
}

/** A single alert card: severity/type display + Close action. */
export function AlertCard({ alert, closing, onClose }: AlertCardProps) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 transition-opacity ${alert.status === "closed" ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_CLASSES[alert.severity] ?? "bg-muted text-muted-foreground"}`}
            >
              {alert.severity}
            </span>
            <span className="text-xs text-muted-foreground">
              {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{formatDate(alert.createdAt)}</span>
          </div>
          <p className="text-sm font-medium">{alert.alertMessage}</p>
          {alert.recommendedAction && (
            <p className="text-xs text-muted-foreground">{alert.recommendedAction}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {alert.executiveName && (
              <span>SE: <span className="font-medium text-foreground">{alert.executiveName}</span></span>
            )}
            {alert.customerName && (
              <span>Customer: <span className="font-medium text-foreground">{alert.customerName}</span></span>
            )}
          </div>
        </div>
        {alert.status === "open" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onClose(alert.id)}
            disabled={closing}
            className="shrink-0 gap-1.5 text-xs"
          >
            <X size={12} />
            {closing ? "Closing…" : "Close"}
          </Button>
        )}
        {alert.status === "closed" && (
          <span className="shrink-0 text-xs text-muted-foreground">Closed</span>
        )}
      </div>
    </div>
  );
}
