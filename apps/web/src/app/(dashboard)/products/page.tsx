import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { getProductsActionConfig } from "../../../features/products/products-api";
import { ProductsList } from "../../../features/products/products-list";
import { requireAuthToken } from "../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  // ACCOUNTANT can view the catalogue + manage stock (read-only catalogue).
  if (!canAccessSection(auth, "products")) {
    redirect(dashboardForRole(auth.role));
  }

  // The oils table is fetched client-side with TanStack Query.
  const config = getProductsActionConfig();

  return (
    <ProductsList
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
