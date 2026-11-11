import { ApiError } from "../lib/errors";

/** One pack row of a product: just its litre size. Pricing (MRP/MOP/DLP) is no
 *  longer catalogue data — it's entered per scenario in the Margin simulator. */
export interface PackInput {
  packSize: number;
}

function positive(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse + validate the `packs` array from a product create/update body.
 * Each pack needs a positive litre size. Deduped by pack size, sorted ascending.
 */
export function parsePacks(raw: unknown): PackInput[] {
  const list = Array.isArray(raw) ? raw : [];
  const bySize = new Map<number, PackInput>();
  for (const item of list) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const packSize = positive(rec.packSize);
    if (packSize === null) continue;
    bySize.set(packSize, { packSize });
  }
  const packs = [...bySize.values()].sort((a, b) => a.packSize - b.packSize);
  if (packs.length === 0) {
    throw new ApiError("INVALID_FIELD", "Add at least one pack size.", 422);
  }
  return packs;
}

/** Column array for the single `product_packs` upsert: one size per pack. */
export function packWriteArrays(packs: PackInput[]) {
  return {
    sizes: packs.map((p) => p.packSize),
  };
}
