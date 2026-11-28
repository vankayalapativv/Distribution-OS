import * as Crypto from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "./api";
import { authHeaders } from "./auth-headers";
import { useAuth } from "./auth";
import {
  fetchClaim,
  fetchClaimCategories,
  resubmitClaim,
  submitExpenseClaim,
  type ClaimCategory,
  type ExpenseClaim,
} from "./expense-claims";
import { pickFromCamera, pickFromGallery } from "./photo-picker";

/** Today's date as "YYYY-MM-DD" in IST — the business day the rest of the system
 *  uses (the API derives dates from `now() at time zone 'Asia/Kolkata'`). Using
 *  UTC here would mis-stamp claims filed between IST midnight and 05:30. */
const todayISO = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** State + submit/resubmit for the expense-claim form. Doubles as the edit form
 *  when an `id` param is passed (prefills from the cached claims list). */
export function useClaimForm() {
  const token = useAuth((s) => s.token);
  const queryClient = useQueryClient();
  const editId = useLocalSearchParams<{ id?: string }>().id ?? null;

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [editStatus, setEditStatus] = useState<ExpenseClaim["status"] | null>(null);
  const [editHasReceipt, setEditHasReceipt] = useState(false);
  // Per-open cache-bust so the attached-receipt thumbnail always reflects the
  // latest upload (the /bill URL is stable per claim, so a replaced receipt
  // would otherwise show the stale cached image on the next open).
  const [openedAt] = useState(() => Date.now());

  const categoriesQuery = useQuery<ClaimCategory[]>({
    queryKey: ["claim-categories"],
    queryFn: () => fetchClaimCategories(token),
    enabled: Boolean(token),
  });

  // The claim being edited: seeded from the list cache when we have it, else
  // fetched by id so a cold deep-link / restored route still prefills. staleTime
  // keeps the cache seed from triggering a redundant refetch on every open.
  const editClaimQuery = useQuery<ExpenseClaim>({
    queryKey: ["claim", editId],
    queryFn: () => fetchClaim(editId!, token),
    enabled: Boolean(editId && token),
    staleTime: 60_000,
    initialData: () =>
      (queryClient.getQueryData<ExpenseClaim[]>(["my-claims"]) ?? []).find((c) => c.id === editId),
  });
  const editClaim = editClaimQuery.data;
  // Surface the by-id fetch's state so a cold-cache edit shows a spinner / a
  // retryable error instead of a silently blank form.
  const editLoading = Boolean(editId) && !editClaim && editClaimQuery.isLoading;
  const editError = Boolean(editId) && !editClaim && editClaimQuery.isError;

  useEffect(() => {
    if (!editId || prefilled || !editClaim) return;
    setCategoryId(editClaim.categoryId);
    setAmount(String(editClaim.amount));
    setDate(editClaim.date.slice(0, 10)); // normalize an ISO timestamp to YYYY-MM-DD
    setRemarks(editClaim.remarks ?? "");
    setEditStatus(editClaim.status);
    setEditHasReceipt(editClaim.hasReceipt);
    setPrefilled(true);
  }, [editId, prefilled, editClaim]);

  async function pickReceipt(from: "camera" | "gallery") {
    const res = from === "camera" ? await pickFromCamera() : await pickFromGallery(1);
    if (res.error) setError(res.error);
    else if (res.photos[0]) { setReceiptUri(res.photos[0].uri); setError(null); }
  }

  async function save() {
    if (busy) return;
    const amountNum = Number(amount);
    if (!categoryId) { setError("Pick a category."); return; }
    if (!(amountNum > 0)) { setError("Enter an amount greater than 0."); return; }
    if (!editId && !receiptUri) { setError("Attach the receipt photo."); return; }
    setBusy(true);
    try {
      const common = { categoryId, amount: amountNum, expenditureDate: date, remarks: remarks || null };
      if (editId) await resubmitClaim(editId, { ...common, receiptUri }, token);
      else await submitExpenseClaim({ ...common, receiptUri: receiptUri!, clientUuid: Crypto.randomUUID() }, token);
      await queryClient.invalidateQueries({ queryKey: ["my-claims"] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the claim.");
      setBusy(false);
    }
  }

  // The attached receipt lives behind an authed endpoint — view it with Bearer
  // auth headers (same pattern as market-intelligence photos).
  const billUri = editId && editHasReceipt ? `${API_BASE_URL}/expense-claims/${editId}/bill?t=${openedAt}` : null;

  return {
    editId,
    editStatus,
    editHasReceipt,
    editLoading,
    editError,
    retryEdit: editClaimQuery.refetch,
    billUri,
    authHeaders: authHeaders(token),
    categories: categoriesQuery.data ?? [],
    categoriesLoading: categoriesQuery.isPending,
    categoryId, setCategoryId,
    amount, setAmount,
    date, setDate,
    remarks, setRemarks,
    receiptUri, pickReceipt,
    error, busy, save,
  };
}
