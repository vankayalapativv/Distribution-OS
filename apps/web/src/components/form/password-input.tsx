"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password input with a click-to-toggle show/hide eye (matches the mobile
 * login). Drop-in replacement for <Input type="password"> — forwards every
 * native input prop; the toggle only swaps the input's type locally.
 */
export function PasswordInput({
  className,
  containerClassName,
  ...props
}: ComponentProps<"input"> & { readonly containerClassName?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={cn("relative", containerClassName)}>
      <Input {...props} type={show ? "text" : "password"} className={cn("pr-9", className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-2.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
      </button>
    </div>
  );
}
