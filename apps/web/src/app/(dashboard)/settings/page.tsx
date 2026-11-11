export const dynamic = "force-dynamic";

import { SettingsDialog } from "@/features/settings/settings-dialog";
import { loadSettingsProps } from "@/features/settings/settings-loader";

// Full-page route: a hard load / refresh of /settings, or the billing
// payment-return redirect. Soft navigations are intercepted by the @modal slot
// (see (dashboard)/@modal/(.)settings) so the dialog overlays the page you were
// on; this fallback renders when there is no page behind to preserve.
export default async function SettingsRoute({
  searchParams,
}: {
  readonly searchParams: Promise<{ checkout?: string; tab?: string }>;
}) {
  const props = await loadSettingsProps(await searchParams);
  return <SettingsDialog {...props} dismissMode="href" />;
}
