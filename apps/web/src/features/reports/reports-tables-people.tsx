"use client";

/** Field-activity tables: distance travelled + customer onboarding. */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow, RIGHT } from "./reports-table-kit";
import type { DistanceRow, OnboardingRow } from "./reports-types";

export function DistanceTable({ rows }: { readonly rows: DistanceRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Distance (km)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={3} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-muted-foreground">{r.role}</TableCell>
              <TableCell className={RIGHT}>{r.km.toFixed(1)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function OnboardingTable({ rows }: { readonly rows: OnboardingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales executive</TableHead>
          <TableHead className="text-right">New customers</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={2} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className={RIGHT}>{r.count}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
