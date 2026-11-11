"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SuperAdminSetupUser } from "./super-admin-types";

/** Per-row ⋮ kebab for the Users table: Edit · Set password · Activate/
 *  Deactivate · Manage sessions. Deactivation is blocked for your own row and
 *  for any Super Admin (you can always re-activate). */
export function UserActionsMenu({
  user,
  isSelf,
  onEdit,
  onSetPassword,
  onToggleStatus,
  onManageSessions,
}: {
  readonly user: SuperAdminSetupUser;
  readonly isSelf: boolean;
  readonly onEdit: () => void;
  readonly onSetPassword: () => void;
  readonly onToggleStatus: () => void;
  readonly onManageSessions: () => void;
}) {
  const [open, setOpen] = useState(false);
  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const active = user.status === "active";
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");
  // You can always activate; deactivation is guarded.
  const deactivateBlocked = active && (isSelf || isSuperAdmin);
  const blockReason = isSelf
    ? "You can't deactivate your own account."
    : "A Super Admin can't be deactivated.";

  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          title="Actions"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-48 gap-0.5 p-1.5">
          <button type="button" className={cn(itemClass, "text-foreground")} onClick={() => run(onEdit)}>
            Edit
          </button>
          <button type="button" className={cn(itemClass, "text-primary")} onClick={() => run(onSetPassword)}>
            Set password
          </button>
          <button type="button" className={cn(itemClass, "text-foreground")} onClick={() => run(onManageSessions)}>
            Manage sessions
          </button>
          <button
            type="button"
            disabled={deactivateBlocked}
            title={deactivateBlocked ? blockReason : undefined}
            className={cn(itemClass, active ? "text-destructive" : "text-foreground")}
            onClick={() => run(onToggleStatus)}
          >
            {active ? "Deactivate" : "Activate"}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
