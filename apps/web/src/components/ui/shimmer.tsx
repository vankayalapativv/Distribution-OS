import { cn } from "@/lib/utils";

/**
 * A muted block with a light band sweeping across it — the app's shimmer
 * loading primitive (keyframe `dash-shimmer` is defined in globals.css). Size it
 * to the content it stands in for so a load reads as "this exact thing is
 * arriving". Shared by the dashboard skeleton kit and any feature that needs it.
 */
export function Shimmer({ className, style }: { readonly className?: string; readonly style?: React.CSSProperties }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-slate-200/70 dark:bg-slate-700/40", className)}
      style={style}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
        style={{ animation: "dash-shimmer 1.5s infinite" }}
      />
    </div>
  );
}
