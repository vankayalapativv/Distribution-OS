import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { ManagedProduct } from "./products-api";
import { fieldForServerError, type ProductFields, type ProductField } from "./product-form-logic";

export type SaveOutcome =
  | { ok: true }
  /** A specific field was rejected server-side (client already validated). */
  | { ok: false; field: ProductField; fieldMessage: string }
  /** A general (non-field) failure. */
  | { ok: false; generalError: string };

/** POST a new product or PATCH an existing one; map a failure to its field (409/422)
 *  or a general error. Pure of React — the hook applies the outcome to state. */
export async function saveProduct(
  actionConfig: ActionConfig,
  editTarget: ManagedProduct | null,
  values: ProductFields,
): Promise<SaveOutcome> {
  try {
    await apiRequest<{ product: ManagedProduct }>(
      actionConfig,
      editTarget ? "PATCH" : "POST",
      editTarget ? `/products/${editTarget.id}` : "/products",
      {
        productName: values.name.trim(),
        brand: values.brand.trim(),
        hsnCode: values.hsnCode.trim(),
        unit: values.unit,
        segments: values.segments,
        packs: values.unit === "litres" ? values.packs : [],
      },
    );
    return { ok: true };
  } catch (err) {
    const field = fieldForServerError(err);
    if (field) return { ok: false, field, fieldMessage: errorMessage(err, "That value was rejected.") };
    return {
      ok: false,
      generalError: errorMessage(
        err,
        editTarget ? "Couldn't update the product. Try again." : "Couldn't create the product. Try again.",
      ),
    };
  }
}
