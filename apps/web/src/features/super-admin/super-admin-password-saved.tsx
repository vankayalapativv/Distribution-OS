"use client";

import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";

/** The post-set view: shows the new password once, with Copy + Done. */
export function PasswordSaved({
  saved,
  userName,
  copied,
  onCopy,
  onClose,
}: Readonly<{
  saved: string;
  userName: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}>) {
  return (
    <>
      <DialogBody className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-xs font-medium text-green-800">
            New password set. Share it with {userName} now — it cannot be shown again.
          </p>
          <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-green-900">{saved}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
