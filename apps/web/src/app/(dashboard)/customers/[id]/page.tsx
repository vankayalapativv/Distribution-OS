import { notFound } from "next/navigation";
import { requireSectionAccess } from "../../../../features/auth/auth-role";
import { getCustomer, getActionConfig } from "../../../../features/customers/customers-api";
import { CustomerDetail } from "../../../../features/customers/customer-detail";
import { requireAuthToken } from "../../../../features/auth/server-session";

export const dynamic = "force-dynamic";

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  // Same configurable section gate as the customers LIST page, so a revoked
  // `section:customers` permission also blocks the detail route.
  const auth = await requireSectionAccess("customers");
  const authToken = await requireAuthToken();

  let customer;
  try {
    customer = await getCustomer(id);
  } catch {
    notFound();
  }

  const config = getActionConfig();

  return (
    <CustomerDetail
      customer={customer}
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
