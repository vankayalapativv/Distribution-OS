/** Shape of GET /public/customer-statement/:token (mirrors the API's
 *  PublicStatement in apps/api/src/services/customer-statement.ts). */

export interface StatementLedgerRow {
  date: string;
  type: "Sale" | "Rcpt" | "Sale_re";
  vchNo: string | null;
  /** Human description: "Opening Balance" | "Sales" | payment mode | "Sales_return". */
  narration: string;
  debit: number | null;
  credit: number | null;
  /** Running balance; >= 0 means Dr (customer owes), < 0 means Cr. */
  balance: number;
  paidOff?: boolean;
  partiallyPaid?: boolean;
}

export interface PublicStatement {
  company: {
    legalName: string;
    gstin: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
  };
  customer: { name: string; city: string | null };
  asOf: string;
  totalOutstanding: number;
  /** Customer payments still awaiting verification (already in the ledger,
   *  not yet applied to outstanding). 0 when none. */
  paymentsUnderVerification: number;
  ageing: { "0_30": number; "30_45": number; "45_60": number; "60_plus": number };
  ledger: {
    from: string;
    to: string;
    openingBalance: number;
    rows: StatementLedgerRow[];
    totals: { debit: number; credit: number; closingBalance: number };
  };
}
