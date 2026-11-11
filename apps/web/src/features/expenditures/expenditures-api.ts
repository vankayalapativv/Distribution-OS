/**
 * Expenditure types + server-side config. Two kinds of spend, decided by the
 * CATEGORY (not per entry): 'compulsory' fixed overheads vs 'variable'.
 */
export type ExpenditureType = "compulsory" | "variable";

export interface ExpenditureCategory {
  id: string;
  name: string;
  type: ExpenditureType;
  isSystem: boolean;
  isActive: boolean;
}

export interface Expenditure {
  id: string;
  expenditureCode: string;
  expenditureDate: string;
  categoryId: string;
  categoryName: string;
  type: ExpenditureType;
  amount: number;
  paymentMode: string | null;
  paidTo: string | null;
  userId: string | null;
  userName: string | null;
  remarks: string | null;
  hasBill: boolean;
  createdAt: string;
}

export interface ExpenditureSummary {
  total: number;
  compulsory: number;
  variable: number;
  entries: number;
  categories: {
    categoryId: string;
    categoryName: string;
    type: ExpenditureType;
    entries: number;
    amount: number;
  }[];
}

export const EXPENDITURE_PAYMENT_MODES: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];

export function paymentModeLabel(mode: string | null): string {
  if (!mode) return "—";
  return EXPENDITURE_PAYMENT_MODES.find((m) => m.value === mode)?.label ?? mode;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
