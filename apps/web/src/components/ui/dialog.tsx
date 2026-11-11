"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * Distribution OS dialog system — one shared frame for every dialog in the app.
 *
 * Structure: <DialogContent size> wraps a flex column capped at 85vh. Compose
 *   <DialogHeader>   — pinned title + optional description (border-b)
 *   <DialogBody>     — the ONLY scrolling region (fields / sections / a viewer)
 *   <DialogFooter>   — pinned action bar, plain surface + border-t, actions right
 * so the primary action is always visible on tall forms.
 *
 * Sizes (fixed tiers, pick by purpose): sm confirms/tiny · md standard forms ·
 * lg rich multi-section forms · xl viewers. Long forms group fields with
 * <DialogSection label="…">. Give <DialogBody> `space-y-4` for a flat form or
 * `space-y-6` when it holds several <DialogSection>s.
 */

const dialogSizes = {
  sm: "sm:max-w-[500px]",
  md: "sm:max-w-[640px]",
  lg: "sm:max-w-[880px]",
  xl: "sm:max-w-[1080px]",
} as const

type DialogSize = keyof typeof dialogSizes

function Dialog({ ...props }: Readonly<DialogPrimitive.Root.Props>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: Readonly<DialogPrimitive.Trigger.Props>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: Readonly<DialogPrimitive.Portal.Props>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: Readonly<DialogPrimitive.Close.Props>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: Readonly<DialogPrimitive.Backdrop.Props>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-foreground/25 duration-150 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "md",
  ...props
}: DialogPrimitive.Popup.Props & {
  readonly showCloseButton?: boolean
  /** Fixed width tier — sm 500 · md 640 · lg 880 · xl 1080. */
  readonly size?: DialogSize
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          dialogSizes[size],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground"
              />
            }
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

/** Pinned header: title + optional description. `pr-12` clears the close button. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-none flex-col gap-1 border-b border-border px-6 py-4 pr-12", className)}
      {...props}
    />
  )
}

/** The single scrolling region. Pass `space-y-4` (flat form) or `space-y-6` (sectioned). */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  )
}

/** A labeled group inside a long form: an uppercase label + rule, then fields. */
function DialogSection({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { readonly label?: React.ReactNode }) {
  return (
    <div data-slot="dialog-section" className={cn("space-y-4", className)} {...props}>
      {label ? (
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            {label}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** Pinned action bar — plain surface + top border, actions right-aligned. */
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  readonly showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-none flex-col-reverse gap-2.5 border-t border-border bg-popover px-6 py-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: Readonly<DialogPrimitive.Title.Props>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-lg leading-snug font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: Readonly<DialogPrimitive.Description.Props>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogSection,
  DialogTitle,
  DialogTrigger,
}
