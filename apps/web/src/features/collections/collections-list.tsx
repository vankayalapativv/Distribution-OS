"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { NewItemsBanner } from "@/features/shell/new-items-banner";
import { type ActionConfig } from "@/lib/api-client";
import { collectionColumns } from "./collections-columns";
import { collectionSkeleton } from "./collections-columns-skeleton";
import { CollectionsCreateDialog } from "./collections-create-dialog";
import { CollectionsFilterBar } from "./collections-filter-bar";
import { CollectionsEmpty, CollectionsSubtitle } from "./collections-list-parts";
import { useCollectionsList } from "./use-collections-list";
import type { CollectionsRole } from "./collections-list-logic";
import type { CustomerOption } from "@/features/customers/customer-search-select";
import type { Collector } from "./collections-types";

export type { CollectionsRole } from "./collections-list-logic";

interface CollectionsListProps {
  readonly customers: CustomerOption[];
  readonly collectors: Collector[];
  readonly role: CollectionsRole;
  readonly actionConfig: ActionConfig;
  readonly initialStatus?: string;
}

function CollectionsInner({ customers, collectors, role, actionConfig }: CollectionsListProps) {
  const router = useRouter();
  const c = useCollectionsList(actionConfig, customers);
  const canCreate = role === "SUPER_ADMIN" || role === "MANAGER";
  const [createOpen, setCreateOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <>
      <DashboardShell role={role} active="collections">
        <PageHeader
          title="Collections"
          subtitle={<CollectionsSubtitle total={c.total} isLoading={c.isLoading} pendingCount={c.pendingCount} />}
          action={canCreate ? <Button onClick={() => setCreateOpen(true)}>+ Record Collection</Button> : undefined}
        />

        <CollectionsFilterBar
          statusFilter={c.statusFilter}
          onStatus={(v) => c.url.setFilter("status", v)}
          search={c.search}
          setSearch={c.setSearch}
          collectors={collectors}
          collectedBy={c.collectedBy}
          onCollectedBy={(v) => c.url.setFilter("collectedBy", v)}
          collectionDate={c.collectionDate}
          dateOpen={dateOpen}
          setDateOpen={setDateOpen}
          onDate={(d) => { c.url.setFilter("date", d ? format(d, "yyyy-MM-dd") : ""); setDateOpen(false); }}
          customerId={c.customerId}
          customerName={c.customerName}
          onClearCustomer={() => c.url.setFilter("customerId", "")}
          hasFilters={c.hasFilters}
          onClear={() => { c.setSearch(""); c.url.clearFilters(); }}
          total={c.total}
          isLoading={c.isLoading}
        />

        {c.error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{c.error.message}</div>}

        <NewItemsBanner
          count={c.newCount}
          noun="collection"
          onLoad={() => { void c.acknowledge(); void c.queryClient.invalidateQueries({ queryKey: ["collections"] }); }}
        />

        <DataTable
          table={c.table}
          columnCount={collectionColumns.length}
          isLoading={c.showSkeleton}
          skeleton={collectionSkeleton}
          pageSize={c.pageSize}
          pageCount={c.pageCount}
          rowClassName={(row) => (c.highlightSince && row.createdAt > c.highlightSince ? "bg-blue-50/60" : undefined)}
          empty={<CollectionsEmpty hasFilters={c.hasFilters} canCreate={canCreate} onCreate={() => setCreateOpen(true)} />}
          onRowClick={(row) => router.push(`/collections/${row.id}`)}
        />
      </DashboardShell>

      {canCreate && (
        <CollectionsCreateDialog open={createOpen} onOpenChange={setCreateOpen}
          customers={customers} collectors={collectors} actionConfig={actionConfig} />
      )}
    </>
  );
}

export const CollectionsList = withQueryClient(CollectionsInner);
