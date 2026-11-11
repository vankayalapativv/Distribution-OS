import { notFound } from "next/navigation";
import { requireSectionAccess } from "../../../../features/auth/auth-role";
import { getCollection, getActionConfig } from "../../../../features/collections/collections-api";
import { CollectionDetailView } from "../../../../features/collections/collections-detail";
import { requireAuthToken } from "../../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  // Same configurable section gate as the collections LIST page, so a revoked
  // `section:collections` permission also blocks the detail route.
  const auth = await requireSectionAccess("collections");
  const authToken = await requireAuthToken();

  const { id } = await params;

  let collection;
  try {
    collection = await getCollection(id);
  } catch {
    notFound();
  }

  const config = getActionConfig();

  return (
    <CollectionDetailView
      collection={collection}
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
