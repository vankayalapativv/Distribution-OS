import { File } from "expo-file-system";
import { API_BASE_URL, apiFetch } from "./api";
import { postPhotoUpload } from "./photo-upload-post";

/**
 * Field expense claims (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 1).
 * Online-only — the SE/Logistics submit from Settings and track status. The
 * receipt is mandatory, so submit is a single multipart POST.
 */

export type ClaimStatus = "submitted" | "approved" | "rejected";

export interface ExpenseClaim {
  id: string;
  code: string;
  date: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  claimedAmount: number;
  status: ClaimStatus;
  remarks: string | null;
  rejectReason: string | null;
  hasReceipt: boolean;
  approvedAt: string | null;
  createdAt: string;
}

export interface ClaimCategory {
  id: string;
  name: string;
}

export interface NewClaim {
  categoryId: string;
  amount: number;
  expenditureDate: string;
  remarks?: string | null;
  receiptUri: string;
  clientUuid?: string;
}

export function fetchClaimCategories(token: string | null): Promise<ClaimCategory[]> {
  return apiFetch<ClaimCategory[]>("/expense-claims/categories", { token });
}

export function fetchMyClaims(token: string | null): Promise<ExpenseClaim[]> {
  return apiFetch<ExpenseClaim[]>("/expense-claims/mine", { token });
}

/** Submit a claim with its required receipt in one multipart request. */
export async function submitExpenseClaim(input: NewClaim, token: string | null): Promise<void> {
  const form = new FormData();
  form.append("categoryId", input.categoryId);
  form.append("amount", String(input.amount));
  form.append("expenditureDate", input.expenditureDate);
  if (input.remarks) form.append("remarks", input.remarks);
  if (input.clientUuid) form.append("clientUuid", input.clientUuid);
  const name = input.receiptUri.split("/").pop() || "receipt.jpg";
  form.append("file", new File(input.receiptUri) as unknown as Blob, name);
  await postPhotoUpload(
    `${API_BASE_URL}/expense-claims`,
    token ? { Authorization: `Bearer ${token}` } : undefined,
    form,
  );
}

/** Edit a not-yet-approved claim (multipart). Pass `receiptUri` to replace the
 *  attached receipt; omit it to keep the existing one. */
export async function resubmitClaim(
  id: string,
  input: { categoryId: string; amount: number; expenditureDate: string; remarks?: string | null; receiptUri?: string | null },
  token: string | null,
): Promise<void> {
  const form = new FormData();
  form.append("categoryId", input.categoryId);
  form.append("amount", String(input.amount));
  form.append("expenditureDate", input.expenditureDate);
  if (input.remarks) form.append("remarks", input.remarks);
  if (input.receiptUri) {
    const name = input.receiptUri.split("/").pop() || "receipt.jpg";
    form.append("file", new File(input.receiptUri) as unknown as Blob, name);
  }
  await postPhotoUpload(
    `${API_BASE_URL}/expense-claims/${id}/resubmit`,
    token ? { Authorization: `Bearer ${token}` } : undefined,
    form,
  );
}
