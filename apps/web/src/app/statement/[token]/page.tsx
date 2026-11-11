import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { PublicStatementView } from "@/features/statement/public-statement-view";
import type { PublicStatement } from "@/features/statement/statement-types";

export const dynamic = "force-dynamic";

// A public financial statement must never be indexed or followed.
export const metadata: Metadata = {
  title: "Account Statement",
  robots: { index: false, follow: false },
};

interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * Public, no-login customer account statement at /statement/<token>. Lives
 * OUTSIDE the (dashboard) auth group — the root layout renders fine for an
 * unauthenticated visitor. Data comes from the auth-free API route via the
 * server service binding (no token forwarded to the browser). Any unknown or
 * malformed token → 404 (the API itself also guards + 404s).
 */
export default async function StatementPage({ params }: { readonly params: Promise<{ token: string }> }) {
  const { token } = await params;

  const response = await serverApiFetch(`/public/customer-statement/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!response.ok) notFound();

  const body = (await response.json()) as ApiSuccess<PublicStatement>;
  return <PublicStatementView data={body.data} />;
}
