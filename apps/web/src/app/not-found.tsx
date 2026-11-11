import { buttonVariants } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { getAuthToken } from "@/features/auth/server-session";

/**
 * Root 404 — shown for ANY unknown URL outside /dashboard (e.g. a mistyped
 * address), replacing Next's bare default. The primary button adapts to whether
 * the visitor is signed in; both destinations self-heal by session state.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Page not found — Sri Aparajitha Enterprise",
};

export default async function NotFound() {
  const signedIn = Boolean(await getAuthToken());
  const href = signedIn ? "/auth/redirect" : "/login";
  const cta = signedIn ? "Back to dashboard" : "Go to login";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center text-foreground">
      <BrandWordmark />
      <div className="flex flex-col items-center gap-2">
        <p className="text-[64px] font-extrabold leading-none tracking-tight text-primary">404</p>
        <h1 className="text-2xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The address may be mistyped, or the page may have moved. Check the URL, or head back.
        </p>
      </div>
      <a href={href} className={buttonVariants()}>
        {cta}
      </a>
    </main>
  );
}
