/**
 * Invoice-line ⇄ order-SKU matching guards (architecture audit G-0104). A line may
 * only bill a SKU it genuinely corresponds to, so a wrong/different invoice can't
 * slip onto an order. Oils match on viscosity grade + pack size (grade-less SKUs
 * fall back to strong name overlap). Mirrors the web matcher
 * (apps/web .../invoice-sku-match.ts). Split out of invoices.ts; pure functions,
 * no service dependencies.
 */

export interface InvoiceLineItem {
  description: string;
  hsn: string | null;
  quantity: number;
  mrp: number | null;
  price: number | null;
  amount: number | null;
  /** litres for oil lines (qty × pack size) */
  litres: number | null;
  kind: "oil";
  /** The order SKU this line bills (set by the accountant in the review form). */
  orderItemId?: string | null;
}

function matchTokens(s: string): string[] {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(" ").filter((t) => t.length > 1);
}

function viscosityGrade(text: string): string | null {
  // Tolerate a hyphen/space in the grade ("15W-40" / "15W 40" → "15W40"); the
  // catalogue and invoices punctuate it differently, and a hyphen must not hide
  // the grade (else the oil is mis-treated as grade-less and the save is wrongly
  // rejected — the ORD-0262 failure). Mirrors the web matcher.
  const upper = text.toUpperCase();
  const multi = /\b(\d{1,2})W[-\s]?(\d{2,3})\b/.exec(upper);
  if (multi) return `${multi[1]}W${multi[2]}`;
  const sae = /\bSAE\s*(\d{2,3})\b/.exec(upper);
  return sae ? `SAE${sae[1]}` : null;
}

/** Last 10 digits of a phone — tolerant of +91/spaces/dashes. */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

/** Most of the shorter name's significant tokens appear in the other name. */
export function nameMatches(a: string | null, b: string | null): boolean {
  const ta = matchTokens(a ?? "");
  const tb = matchTokens(b ?? "");
  if (ta.length === 0 || tb.length === 0) return false;
  const [short, longSet] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  const hits = short.filter((t) => longSet.has(t)).length;
  return hits >= 1 && hits / short.length >= 0.5;
}

export interface MatchSku {
  label: string;
  hsnCode: string | null;
  packSizeLitres: number | null;
}

/**
 * Does an invoice line genuinely correspond to this order SKU? (strict)
 * Mirrors the web matcher: HSN is the primary gate (exact match — products like
 * coolant (3820) are told apart by HSN, not a guess), then oils match by grade +
 * pack, other products by name.
 */
export function lineMatchesSku(line: InvoiceLineItem, sku: MatchSku): boolean {
  if (!line.hsn || !sku.hsnCode || line.hsn !== sku.hsnCode) return false;

  // Products: graded oils need grade + pack; grade-less (coolant, …) are pinned
  // by their unique HSN, so a strong name overlap suffices.
  const gradeSku = viscosityGrade(sku.label);
  if (gradeSku != null) {
    const pack = line.litres != null && line.quantity > 0 ? line.litres / line.quantity : null;
    if (pack == null || sku.packSizeLitres == null) return false;
    if (Math.abs(pack - sku.packSizeLitres) >= 0.001) return false;
    return viscosityGrade(line.description) === gradeSku;
  }
  const desc = new Set(matchTokens(line.description));
  const lab = matchTokens(sku.label);
  const hits = lab.filter((t) => desc.has(t)).length;
  return lab.length > 0 && hits >= Math.max(2, Math.ceil(lab.length * 0.6));
}
