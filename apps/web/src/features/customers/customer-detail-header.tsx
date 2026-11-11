"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_TONES } from "./customer-detail-sections";
import { CustomerStatementLinkMenu } from "./customer-statement-link-menu";
import type { ActionConfig } from "@/lib/api-client";
import type { Customer } from "./customers-api";

/** Breadcrumb + title + status/exec/code subtitle, with the edit actions for
 *  roles that may edit and the ⋮ share menu for all back-office roles. */
export function CustomerDetailHeader({
  customer,
  canEdit,
  onEdit,
  onStatus,
  actionConfig,
}: {
  readonly customer: Customer;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onStatus: () => void;
  readonly actionConfig: ActionConfig;
}) {
  return (
    <PageHeader
      crumbs={[
        { label: "Management" },
        { label: "Customers", href: "/customers" },
        { label: customer.legalName },
      ]}
      title={customer.legalName}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={customer.status} tones={STATUS_TONES} />
          {customer.salesExecutiveName ? <span>{customer.salesExecutiveName}</span> : null}
          <span className="font-mono text-xs">{customer.customerCode}</span>
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          {canEdit ? (
            <>
              <Button variant="outline" onClick={onStatus}>
                Change Status
              </Button>
              <Button onClick={onEdit}>Edit</Button>
            </>
          ) : null}
          <CustomerStatementLinkMenu customerId={customer.id} actionConfig={actionConfig} />
        </div>
      }
    />
  );
}
