import { redirect } from "next/navigation";
import { OWNER_HOST } from "../../../lib/owner-host";

export const dynamic = "force-dynamic";

// Deprecated apex cockpit login → the owner subdomain's login.
export default function AdminLoginRedirect() {
  redirect(`https://${OWNER_HOST}/owner/login`);
}
