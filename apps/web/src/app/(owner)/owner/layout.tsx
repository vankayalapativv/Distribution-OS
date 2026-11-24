import type { ReactNode } from "react";

// The owner cockpit is served on its own subdomain (middleware rewrites that
// host's paths into this `/owner` segment). The shell/logout chrome is applied
// per page (so the login page stays bare); this layout is just a passthrough.
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return children;
}
