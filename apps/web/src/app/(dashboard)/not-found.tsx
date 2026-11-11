import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";

/**
 * Shown when a /dashboard/* segment calls `notFound()` (e.g. a detail page for a
 * record that doesn't exist or isn't visible to the current user), instead of the
 * framework's bare default 404.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center text-foreground">
      <BrandWordmark />
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Not found
        </p>
        <h1 className="text-2xl font-semibold">This record doesn&apos;t exist</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page or record you&apos;re looking for may have been removed, or you may not have
          access to it.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
