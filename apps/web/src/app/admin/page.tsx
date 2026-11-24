import { redirect } from "next/navigation";
import { OWNER_HOST } from "../../lib/owner-host";

export const dynamic = "force-dynamic";

// The cockpit moved to its own subdomain so the owner's session cookie is
// host-only and never clobbers a tenant's apex session. The old apex `/admin`
// path now redirects there. (Local dev: use http://owner.localhost:3000/owner.)
export default function AdminRedirect() {
  redirect(`https://${OWNER_HOST}/owner`);
}
