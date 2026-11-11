import { redirect } from "next/navigation";
import { getAuthToken } from "../../features/auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import { OwnerCockpit } from "../../features/cockpit/owner-cockpit";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = await getAuthToken();
  if (!token) redirect("/admin/login");

  const res = await serverApiFetch("/platform/enterprises?status=pending", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) redirect("/admin/login");

  let initial: unknown[] = [];
  if (res.ok) {
    initial = ((await res.json()) as { data?: { enterprises?: unknown[] } }).data?.enterprises ?? [];
  }
  return <OwnerCockpit initial={initial as never} />;
}
