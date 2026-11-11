import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { collectionColumns, PAYMENT_MODE_LABELS, STATUS_CLASSES } from "./collections-columns";
import { collectionSkeleton } from "./collections-columns-skeleton";
import type { Collection } from "./collections-types";

const row: Collection = {
  id: "c1", collectionCode: "COL-0001", collectionDate: "2026-09-14", customerId: "cu1",
  customerName: "Sri Laxmi", customerCity: "Nalgonda", customerPhone: "99887",
  collectedByUserId: "u1", collectedByName: "Ravi", paymentMode: "upi", paymentReferenceNumber: "UTR123",
  collectionAmount: "5000", chequeDate: null, chequeStatus: null, bankName: null, matchedStatus: "matched",
  accountantApprovalStatus: "pending", approvedByAccountantId: null, approvedByAccountantName: null,
  approvedAt: null, incentiveEligible: false, remarks: null, createdBy: null,
  createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z",
};

function renderCell(col: ColumnDef<Collection>, r: Collection) {
  const key = "accessorKey" in col ? (col.accessorKey as keyof Collection) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = { row: { original: r }, getValue: () => (key ? r[key] : undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<div>{(col as any).cell(ctx)}</div>);
}

describe("collectionColumns", () => {
  it("has 8 columns with a matching skeleton", () => {
    expect(collectionColumns).toHaveLength(8);
    expect(collectionSkeleton).toHaveLength(8);
  });

  it("renders code, customer, mode label, reference, amount, collector and status", () => {
    const text = collectionColumns.map((col) => renderCell(col, row).container.textContent).join(" | ");
    expect(text).toContain("COL-0001");
    expect(text).toContain("Sri Laxmi");
    expect(text).toContain("Nalgonda");
    expect(text).toContain("UPI"); // PAYMENT_MODE_LABELS mapping
    expect(text).toContain("UTR123");
    expect(text).toContain("Ravi");
  });

  it("dashes a missing reference and collector, and falls back to the raw mode", () => {
    expect(renderCell(collectionColumns[4], { ...row, paymentReferenceNumber: null }).container.textContent).toContain("—");
    expect(renderCell(collectionColumns[6], { ...row, collectedByName: null }).container.textContent).toContain("—");
    expect(renderCell(collectionColumns[3], { ...row, paymentMode: "barter" }).container.textContent).toContain("barter");
  });

  it("exposes status tone + payment-mode maps", () => {
    expect(STATUS_CLASSES.verified).toMatch(/green/);
    expect(PAYMENT_MODE_LABELS.neft_rtgs).toBe("NEFT/RTGS");
  });

  it("renders every skeleton cell", () => {
    const { container } = render(<table><tbody><tr>{collectionSkeleton.map((cell, i) => <td key={i}>{cell()}</td>)}</tr></tbody></table>);
    expect(container.querySelectorAll("td")).toHaveLength(collectionSkeleton.length);
  });
});
