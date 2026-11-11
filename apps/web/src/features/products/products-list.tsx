"use client";

import { withQueryClient } from "@/components/data-table/query-provider";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { ActionConfig } from "@/lib/api-client";
import { CatalogueTable } from "./products-catalogue-table";
import { ProductsDialogs } from "./products-dialogs";
import { useProductsDialogs } from "./use-products-dialogs";

export type ProductsRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

interface ProductsListProps {
  role: ProductsRole;
  actionConfig: ActionConfig;
}

function ProductsInner({ role, actionConfig }: Readonly<ProductsListProps>) {
  // Single unified Products list. The litres/quantity distinction is the
  // product's `unit`, not a separate tab. ACCOUNTANT views but can't edit.
  const canManage = role !== "ACCOUNTANT";
  const d = useProductsDialogs();

  return (
    <>
      <DashboardShell role={role} active="products">
        <CatalogueTable
          category="oils"
          actionConfig={actionConfig}
          canManage={canManage}
          onAdd={d.handleAdd}
          onEditProduct={d.setProductEdit}
          onDeleteProduct={d.setProductDelete}
        />
      </DashboardShell>

      <ProductsDialogs d={d} actionConfig={actionConfig} />
    </>
  );
}

export const ProductsList = withQueryClient(ProductsInner);
