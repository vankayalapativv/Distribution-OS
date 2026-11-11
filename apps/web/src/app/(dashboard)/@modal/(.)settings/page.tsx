export const dynamic = "force-dynamic";

import { SettingsDialog } from "@/features/settings/settings-dialog";
import { loadSettingsProps } from "@/features/settings/settings-loader";

// Intercepted modal: a soft navigation to /settings (e.g. the avatar link)
// renders the dialog HERE, in the @modal parallel slot, over the page that is
// still mounted in `children`. Closing pops the URL (router.back()) to reveal
// that page again.
export default async function SettingsModal({
  searchParams,
}: {
  readonly searchParams: Promise<{ checkout?: string; tab?: string }>;
}) {
  const props = await loadSettingsProps(await searchParams);
  return <SettingsDialog {...props} dismissMode="back" />;
}
