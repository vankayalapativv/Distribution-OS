"use client";

import { PageHeader } from "@/components/page-header";
import { withQueryClient } from "@/components/data-table/query-provider";
import { type ActionConfig } from "@/lib/api-client";
import { useUrlParam } from "@/lib/use-url-state";
import { useReassign } from "./use-reassign";
import { useReassignList } from "./use-reassign-list";
import { ReassignList } from "./reassign-list";
import { ReassignDetail } from "./reassign-detail";
import type { ReassignCustomerRow } from "./reassign-api";

/** Browse-first reassignment: a searchable customer list (left) with each
 *  customer's current owner + record count, and the reassign detail (right) for
 *  the selected one — move from one SE to another, with history + undo. */
function ReassignViewInner({
  customers,
  actionConfig,
}: {
  readonly customers: ReassignCustomerRow[];
  readonly actionConfig: ActionConfig;
}) {
  const [customerId, setCustomerId] = useUrlParam("customer", { history: "push" });
  const list = useReassignList(customers);
  const state = useReassign(actionConfig, customerId);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Configure" }, { label: "Reassign Customers" }]}
        title="Reassign Customers"
        subtitle="Browse customers, see who owns each, and move a customer — and all of their history — to another sales executive."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <ReassignList
          customers={list.filtered}
          total={customers.length}
          selectedId={customerId}
          onSelect={setCustomerId}
          search={list.search}
          setSearch={list.setSearch}
          owners={list.owners}
          owner={list.owner}
          setOwner={list.setOwner}
        />
        <ReassignDetail state={state} selected={Boolean(customerId)} />
      </div>
    </>
  );
}

export const ReassignView = withQueryClient(ReassignViewInner);
