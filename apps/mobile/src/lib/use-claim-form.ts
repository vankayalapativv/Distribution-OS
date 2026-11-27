import * as Crypto from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import {
  fetchClaimCategories,
  resubmitClaim,
  submitExpenseClaim,
  type ClaimCategory,
  type ExpenseClaim,
} from "./expense-claims";
import { pickFromCamera, pickFromGallery } from "./photo-picker";

const todayISO = (): string => new Date().toISOString().slice(0, 10);

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

  const categoriesQuery = useQuery<ClaimCategory[]>({
    queryKey: ["claim-categories"],
    queryFn: () => fetchClaimCategories(token),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!editId || prefilled) return;
    const claim = (queryClient.getQueryData<ExpenseClaim[]>(["my-claims"]) ?? []).find((c) => c.id === editId);
    if (claim) {
      setCategoryId(claim.categoryId);
      setAmount(String(claim.amount));
      setDate(claim.date);
      setRemarks(claim.remarks ?? "");
    }
    setPrefilled(true);
  }, [editId, prefilled, queryClient]);

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
      if (editId) await resubmitClaim(editId, common, token);
      else await submitExpenseClaim({ ...common, receiptUri: receiptUri!, clientUuid: Crypto.randomUUID() }, token);
      await queryClient.invalidateQueries({ queryKey: ["my-claims"] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the claim.");
      setBusy(false);
    }
  }

  return {
    editId,
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
