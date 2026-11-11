"use client";

import { Button } from "@/components/ui/button";

/** Print action for the standalone receipt page. */
export function ReceiptPrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
