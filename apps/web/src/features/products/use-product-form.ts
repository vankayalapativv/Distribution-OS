"use client";

import { type SyntheticEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type ActionConfig } from "@/lib/api-client";
import type { ManagedProduct, ProductPack, ProductUnit } from "./products-api";
import { computeFieldErrors, type FieldErrors, type ProductField } from "./product-form-logic";
import { useExistingProductNames } from "./use-existing-product-names";
import { saveProduct } from "./product-save";

// Re-exported so existing importers (product-dialog, add-product-wizard) are unchanged.
export { FIELD_STEP, normalizeProductName, computeFieldErrors, validateProductForm, type ProductField, type FieldErrors } from "./product-form-logic";
const ORDER: ProductField[] = ["name", "brand", "hsnCode", "segments", "packs"];
const STEP_FIELDS: Record<number, ProductField[]> = { 0: ["name", "brand", "hsnCode"], 1: ["segments"], 2: ["packs"] };
/** Add / Edit product form state: seeding, live validation, and the save request. */
export function useProductForm(
  open: boolean,
  editTarget: ManagedProduct | null,
  onOpenChange: (open: boolean) => void,
  actionConfig: ActionConfig,
) {
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("litres");
  const [segments, setSegments] = useState<string[]>([]);
  const [packs, setPacks] = useState<ProductPack[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); // general (non-field) error
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ProductField, boolean>>>({});
  const existingNames = useExistingProductNames(open, editTarget, actionConfig);

  // Seed fields when the dialog opens (React "adjust state on change" pattern).
  const key = open ? (editTarget?.id ?? "create") : null;
  const [prevKey, setPrevKey] = useState<string | null>(null);
  if (key !== prevKey) {
    setPrevKey(key);
    if (open) {
      setProductName(editTarget?.productName ?? "");
      setBrand(editTarget?.brand ?? "");
      setHsnCode(editTarget?.hsnCode ?? "");
      setUnit(editTarget?.unit ?? "litres");
      setSegments(editTarget?.segments ?? []);
      setPacks(editTarget?.packs ?? []);
      setError(null); setServerFieldErrors({}); setTouched({});
    }
  }
  const liveErrors = computeFieldErrors({ name: productName, brand, hsnCode, unit, segments, packs }, existingNames);
  const fieldErrors: FieldErrors = { ...liveErrors, ...serverFieldErrors };
  const isStepValid = (step: number) => (STEP_FIELDS[step] ?? []).every((k) => !liveErrors[k]);
  const allValid = Object.keys(liveErrors).length === 0;

  /** Mark a field interacted-with; clears its stale server message + a general error. */
  function touch(field: ProductField) {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
    setServerFieldErrors((s) => {
      if (!s[field]) return s;
      const next = { ...s };
      delete next[field];
      return next;
    });
    setError((g) => (g ? null : g));
  }
  function toggleSegment(s: string) {
    touch("segments");
    setSegments((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  /** Validate, then save; outcome lets the caller reveal/focus the offending field. */
  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>): Promise<{ ok: boolean; field?: ProductField }> {
    e.preventDefault();
    setTouched({ name: true, brand: true, hsnCode: true, segments: true, packs: true });
    const first = ORDER.find((k) => liveErrors[k]);
    if (first) return { ok: false, field: first };
    setBusy(true); setError(null); setServerFieldErrors({});
    const r = await saveProduct(actionConfig, editTarget, { name: productName, brand, hsnCode, unit, segments, packs });
    setBusy(false);
    if (r.ok) {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["brands", "oils"] });
      onOpenChange(false);
      return { ok: true };
    }
    if ("field" in r) { setServerFieldErrors({ [r.field]: r.fieldMessage }); return { ok: false, field: r.field }; }
    setError(r.generalError);
    return { ok: false };
  }

  return {
    productName, setProductName, brand, setBrand, hsnCode, setHsnCode, unit, setUnit,
    segments, toggleSegment, packs, setPacks, busy, error, handleSubmit,
    fieldErrors, touched, touch, isStepValid, allValid,
  };
}

/** The shape the add/edit field components + wizard consume. */
export type ProductForm = ReturnType<typeof useProductForm>;
