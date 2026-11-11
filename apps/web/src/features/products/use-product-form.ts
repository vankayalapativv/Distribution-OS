"use client";

import { type SyntheticEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, ApiRequestError, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ManagedProduct, ProductPack, ProductUnit } from "./products-api";

/** The fields a validation message can attach to. */
export type ProductField = "name" | "brand" | "hsnCode" | "segments" | "packs";
export type FieldErrors = Partial<Record<ProductField, string>>;

/** Which wizard step owns each field — used to jump to the right step on error. */
export const FIELD_STEP: Record<ProductField, number> = {
  name: 0,
  brand: 0,
  hsnCode: 0,
  segments: 1,
  packs: 2,
};

interface ProductFields {
  name: string;
  brand: string;
  hsnCode: string;
  unit: ProductUnit;
  segments: string[];
  packs: ProductPack[];
}

/**
 * Normalize a product name the same way the server does before its uniqueness
 * check (swap non-breaking spaces, collapse whitespace, trim), so the live
 * duplicate warning matches exactly what the server would reject on save.
 */
export function normalizeProductName(name: string): string {
  return name.replaceAll(" ", " ").replaceAll(/\s+/g, " ").trim();
}

/** Per-field validation. `existingNames` holds normalized catalogue names (minus
 *  the product being edited) so a name already in use is flagged before save. */
export function computeFieldErrors(f: ProductFields, existingNames: ReadonlySet<string>): FieldErrors {
  const e: FieldErrors = {};
  const name = normalizeProductName(f.name);
  if (!name) e.name = "Product name is required.";
  else if (existingNames.has(name)) e.name = `“${name}” is already in the catalogue.`;

  if (!f.brand.trim()) e.brand = "Pick a brand, or type a new one.";

  const hsn = f.hsnCode.trim();
  if (!hsn) e.hsnCode = "HSN code is required.";
  else if (!/^\d{8}$/.test(hsn)) e.hsnCode = "HSN code must be exactly 8 digits.";

  if (f.segments.length === 0) e.segments = "Pick at least one segment.";
  // Litres products need pack sizes; quantity products are sold by the piece.
  if (f.unit === "litres" && f.packs.length === 0) e.packs = "Add at least one pack size.";
  return e;
}

/** Back-compat: the first field error as a single message, or null when valid. */
export function validateProductForm(f: ProductFields): string | null {
  const e = computeFieldErrors(f, new Set());
  return e.name ?? e.brand ?? e.hsnCode ?? e.segments ?? e.packs ?? null;
}

/** Map a save failure to the field it belongs to (so we can show + focus it). */
function fieldForServerError(err: unknown): ProductField | null {
  if (!(err instanceof ApiRequestError)) return null;
  const m = err.message.toLowerCase();
  if (err.status === 409) return "name"; // DUPLICATE — "Product … already exists."
  if (err.status === 422) {
    if (m.includes("segment")) return "segments";
    if (m.includes("hsn")) return "hsnCode";
    if (m.includes("pack")) return "packs";
    if (m.includes("name")) return "name";
  }
  return null;
}

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

  // Existing catalogue names, to warn about a duplicate live as the user types.
  // Reuses the full-catalogue read (cached); failure just disables the live hint
  // (the server's 409 on save is the real guard).
  const namesQuery = useQuery({
    queryKey: ["products", "catalogue-names"],
    queryFn: () => apiGet<{ products: Pick<ManagedProduct, "id" | "productName">[] }>(actionConfig, "/products"),
    enabled: open,
    staleTime: 60_000,
  });
  const existingNames = useMemo(() => {
    const set = new Set<string>();
    const self = editTarget ? normalizeProductName(editTarget.productName) : null;
    for (const p of namesQuery.data?.products ?? []) {
      const n = normalizeProductName(p.productName);
      if (n && n !== self) set.add(n);
    }
    return set;
  }, [namesQuery.data, editTarget]);

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
      setError(null);
      setServerFieldErrors({});
      setTouched({});
    }
  }

  const liveErrors = computeFieldErrors(
    { name: productName, brand, hsnCode, unit, segments, packs },
    existingNames,
  );
  // What the UI shows: live validation plus any field-specific server message.
  const fieldErrors: FieldErrors = { ...liveErrors, ...serverFieldErrors };
  const stepFields: Record<number, ProductField[]> = {
    0: ["name", "brand", "hsnCode"],
    1: ["segments"],
    2: ["packs"],
  };
  const isStepValid = (step: number) => (stepFields[step] ?? []).every((k) => !liveErrors[k]);
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

  function touchAll() {
    setTouched({ name: true, brand: true, hsnCode: true, segments: true, packs: true });
  }

  function toggleSegment(s: string) {
    touch("segments");
    setSegments((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  /**
   * Validate, then save. Returns the outcome so the caller can reveal + focus the
   * offending field (and, in the wizard, jump to its step): `{ ok: false, field }`
   * when a field is at fault (including a server 409/422), `{ ok: false }` for a
   * general failure, `{ ok: true }` on success.
   */
  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>): Promise<{ ok: boolean; field?: ProductField }> {
    e.preventDefault();
    touchAll();
    const first = (["name", "brand", "hsnCode", "segments", "packs"] as ProductField[]).find(
      (k) => liveErrors[k],
    );
    if (first) return { ok: false, field: first };

    setBusy(true);
    setError(null);
    setServerFieldErrors({});
    try {
      await apiRequest<{ product: ManagedProduct }>(
        actionConfig,
        editTarget ? "PATCH" : "POST",
        editTarget ? `/products/${editTarget.id}` : "/products",
        {
          productName: productName.trim(),
          brand: brand.trim(),
          hsnCode: hsnCode.trim(),
          unit,
          segments,
          packs: unit === "litres" ? packs : [],
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["brands", "oils"] });
      onOpenChange(false);
      return { ok: true };
    } catch (err) {
      const field = fieldForServerError(err);
      if (field) {
        setServerFieldErrors({ [field]: errorMessage(err, "That value was rejected.") });
        return { ok: false, field };
      }
      setError(
        errorMessage(
          err,
          editTarget ? "Couldn't update the product. Try again." : "Couldn't create the product. Try again.",
        ),
      );
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  return {
    productName, setProductName, brand, setBrand, hsnCode, setHsnCode,
    unit, setUnit, segments, toggleSegment, packs, setPacks,
    busy, error, handleSubmit,
    // error model
    fieldErrors, touched, touch, isStepValid, allValid,
  };
}
