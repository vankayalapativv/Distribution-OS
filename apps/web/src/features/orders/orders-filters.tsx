"use client";

import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "./search-select";
import { OrdersSalesExecFilter } from "./orders-sales-exec-filter";
import { OrdersDateRangeFilter } from "./orders-date-range-filter";
import type { SalesExecutive } from "./orders-api";

interface OrdersFiltersProps {
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly city: string;
  readonly onCityChange: (value: string) => void;
  readonly cities: string[];
  readonly salesExecutiveId: string;
  readonly onSalesExecChange: (value: string) => void;
  readonly salesExecutives: SalesExecutive[];
  readonly dateRange: DateRange | undefined;
  readonly onDateRangeChange: (value: DateRange | undefined) => void;
  readonly onClear: () => void;
  readonly hasActiveFilters: boolean;
}

export function OrdersFilters({
  search,
  onSearchChange,
  city,
  onCityChange,
  cities,
  salesExecutiveId,
  onSalesExecChange,
  salesExecutives,
  dateRange,
  onDateRangeChange,
  onClear,
  hasActiveFilters,
}: OrdersFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[180px]">
        <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
        <Input
          placeholder="ORD id, invoice, customer, city, phone, SE…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 bg-white"
        />
      </div>
      <div className="w-[190px]">
        <Label className="text-xs text-muted-foreground mb-1.5 block">City</Label>
        <SearchSelect
          items={[{ id: "", name: "All cities" }, ...cities.map((c) => ({ id: c, name: c }))]}
          valueKey={city}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={onCityChange}
          placeholder="All cities"
          searchPlaceholder="Search city…"
          emptyText="No cities found"
          contentClassName="w-[240px] p-0"
        />
      </div>
      {salesExecutives.length > 0 && (
        <OrdersSalesExecFilter
          salesExecutiveId={salesExecutiveId}
          onSalesExecChange={onSalesExecChange}
          salesExecutives={salesExecutives}
        />
      )}
      <OrdersDateRangeFilter dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
      {hasActiveFilters && (
        <div className="flex items-end">
          <Button variant="ghost" onClick={onClear} className="h-9">
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
