import type { SqlClient } from "../lib/db";
import type { MetricsRange } from "./dashboard-metrics";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A number+unit pack token, e.g. "900ML", "7.5LTR", "1L." (whole token). */
const PACK_TOKEN = /^\d+(?:\.\d+)?(?:ML|LTR|LT|L)\.?$/i;
/** A bare unit token when the number is split off, e.g. "L", "ML." */
const UNIT_TOKEN = /^(?:ML|LTR|LT|L)\.?$/i;
/** A bare number token, e.g. "5", "7.5". */
const NUMBER_TOKEN = /^\d+(?:\.\d+)?$/;

/**
 * "SILKOLENE SUPER 4 SAE 10W30 900ML" → "SILKOLENE SUPER 4 SAE 10W30".
 * Groups all pack sizes of one product under a single base row. Token-based (the
 * trailing pack is "900ML" or a split "900 ML") so the scan stays linear — the
 * earlier single anchored-at-end regex backtracked super-linearly (S8786).
 */
export function baseProductName(description: string): string {
  const tokens = description.trim().split(/\s+/);
  if (tokens.length < 2) return description.trim();
  const last = tokens.at(-1) ?? "";
  // Trailing "900ML" / "1L." as one token (keep the product name before it).
  if (PACK_TOKEN.test(last)) {
    return tokens.slice(0, -1).join(" ");
  }
  // Trailing "900 ML" split across two tokens — strip both, keep the name.
  if (tokens.length >= 3 && UNIT_TOKEN.test(last) && NUMBER_TOKEN.test(tokens.at(-2) ?? "")) {
    return tokens.slice(0, -2).join(" ");
  }
  return description.trim();
}

/**
 * Catalogue-vs-invoice names differ only in punctuation ("10W-30" vs "10W30",
 * spacing) — compare on letters+digits only.
 */
function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

interface Bucket {
  litres: number;
  quantity: number;
  beforeGst: number;
  invoices: Set<string>;
  customers: Set<string>;
}

function emptyBucket(): Bucket {
  return { litres: 0, quantity: 0, beforeGst: 0, invoices: new Set(), customers: new Set() };
}

/** Get the bucket for a roll-up key, creating + storing an empty one on first use. */
function bucketFor(map: Map<string, Bucket>, key: string): Bucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = emptyBucket();
    map.set(key, bucket);
  }
  return bucket;
}

function bucketOut(b: Bucket) {
  return {
    litres: round2(b.litres),
    quantity: round2(b.quantity),
    beforeGst: round2(b.beforeGst),
    invoices: b.invoices.size,
    customers: b.customers.size,
  };
}

/**
 * SKU analytics from uploaded invoice line items — the "Billed (from
 * invoices)" dashboard section. Everything derives from invoices.line_items;
 * brand/segment come from best-effort catalogue matching (else "Unmatched").
 */
export async function getSkuAnalytics(sql: SqlClient, range: MetricsRange) {
  // All FIVE queries below are mutually independent — the three data pulls and
  // the two six-month trend rollups depend only on the range/current date, never
  // on each other's results or on the in-memory aggregation between them. Run
  // them in ONE Promise.all so latency is a single round-trip, not five
  // sequential ones (2026-08-22: sequential awaits made this the second
  // KPIs-style bottleneck — ~600ms isolated but ~5s p50 under concurrent load).
  const [lines, returnLines, catalogue, trend, returnTrend] =
    await Promise.all([
      sql`
        /* sku_analytics_lines */
        select
          trim(li->>'description') as "description",
          coalesce((li->>'quantity')::numeric, 0) as "qty",
          coalesce((li->>'litres')::numeric, 0) as "litres",
          coalesce((li->>'price')::numeric, 0) as "price",
          i.id as "invoiceId",
          i.customer_id as "customerId",
          c.legal_name as "customerName"
        from invoices i
        join customers c on c.id = i.customer_id
        cross join lateral jsonb_array_elements(coalesce(i.line_items, '[]'::jsonb)) li
        where i.invoice_date between ${range.from}::date and ${range.to}::date
          and i.doc_status <> 'cancelled'
          and trim(coalesce(li->>'description', '')) <> ''
          -- Oils only (the catalogue is oils-only; non-oil legacy lines excluded).
          and coalesce(li->>'kind', 'oil') = 'oil'
      ` as Promise<Row[]>,

      // Returned lines in the same period — subtracted from the billed figures so
      // the dashboard shows NET sold. Attributed by the invoice's date (same basis
      // as the positive lines above), grouped by the snapshot description.
      sql`
        /* sku_analytics_return_lines */
        select
          sri.description as "description",
          sri.kind as "kind",
          coalesce(sri.quantity_units, 0) as "qty",
          coalesce(sri.litres, 0) as "litres",
          coalesce(sri.taxable_amount, 0) as "beforeGst",
          i.id as "invoiceId",
          i.customer_id as "customerId",
          c.legal_name as "customerName"
        from sales_return_items sri
        join sales_returns sr on sr.id = sri.sales_return_id
        join invoices i on i.id = sr.invoice_id
        join customers c on c.id = i.customer_id
        where i.invoice_date between ${range.from}::date and ${range.to}::date
          and i.doc_status <> 'cancelled'
          and trim(coalesce(sri.description, '')) <> ''
      ` as Promise<Row[]>,

      sql`
        /* sku_analytics_catalogue */
        select
          p.product_name as "name",
          p.brand,
          (select min(ps.segment) from product_segments ps where ps.product_id = p.id) as "segment"
        from products p
      ` as Promise<Row[]>,

      // Six-month trend (independent of the selected range).
      sql`
        /* sku_analytics_trend */
        select
          to_char(date_trunc('month', i.invoice_date), 'YYYY-MM') as "month",
          coalesce(sum((li->>'litres')::numeric) filter (where coalesce(li->>'kind','oil') = 'oil'), 0) as "litres",
          coalesce(sum(coalesce((li->>'quantity')::numeric, 0) * coalesce((li->>'price')::numeric, 0)) filter (where coalesce(li->>'kind','oil') = 'oil'), 0) as "beforeGst"
        from invoices i
        cross join lateral jsonb_array_elements(coalesce(i.line_items, '[]'::jsonb)) li
        where i.invoice_date >= (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - interval '5 months')::date
          and i.doc_status <> 'cancelled'
        group by 1
        order by 1
      ` as Promise<Row[]>,

      // Returns per month (netted out of the trend, keyed on the invoice's month).
      sql`
        /* sku_analytics_return_trend */
        select
          to_char(date_trunc('month', i.invoice_date), 'YYYY-MM') as "month",
          coalesce(sum(sri.litres) filter (where sri.kind = 'oil'), 0) as "litres",
          coalesce(sum(sri.taxable_amount) filter (where sri.kind = 'oil'), 0) as "beforeGst"
        from sales_return_items sri
        join sales_returns sr on sr.id = sri.sales_return_id
        join invoices i on i.id = sr.invoice_id
        where i.invoice_date >= (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - interval '5 months')::date
          and i.doc_status <> 'cancelled'
        group by 1
      ` as Promise<Row[]>,
    ]);

  const productByName = new Map<string, { brand: string | null; segment: string | null }>();
  for (const p of catalogue) {
    productByName.set(normalizeName(str(p.name)), {
      brand: str(p.brand) || null,
      segment: str(p.segment) || null,
    });
  }
  // ── Aggregate ──────────────────────────────────────────────────────────────
  interface BaseAgg extends Bucket {
    packs: Map<string, Bucket & { packLitresPerUnit: number | null }>;
    buyers: Map<string, Bucket & { customerName: string }>;
  }
  const bases = new Map<string, BaseAgg>();
  const brands = new Map<string, Bucket>();
  const segments = new Map<string, Bucket>();
  const totals = { oil: emptyBucket() };

  interface Entry {
    description: string;
    qty: number;
    litres: number;
    beforeGst: number;
    invoiceId: string;
    customerId: string;
    customerName: string;
    /** Positive (billed) rows count toward invoice/customer tallies; returns don't. */
    countable: boolean;
  }
  const billedEntries: Entry[] = lines.map((line) => {
    const qty = num(line.qty);
    return {
      description: str(line.description),
      qty,
      litres: num(line.litres),
      beforeGst: qty * num(line.price),
      invoiceId: str(line.invoiceId),
      customerId: str(line.customerId),
      customerName: str(line.customerName),
      countable: true,
    };
  });
  // Returns are the same shape with negated values (net sold = billed − returned).
  const returnEntries: Entry[] = returnLines.map((line) => ({
    description: str(line.description),
    qty: -num(line.qty),
    litres: -num(line.litres),
    beforeGst: -num(line.beforeGst),
    invoiceId: str(line.invoiceId),
    customerId: str(line.customerId),
    customerName: str(line.customerName),
    countable: false,
  }));

  for (const line of [...billedEntries, ...returnEntries]) {
    const { description, qty, litres, beforeGst, invoiceId, customerId } = line;
    const base = baseProductName(description);

    const add = (b: Bucket) => {
      b.litres += litres;
      b.quantity += qty;
      b.beforeGst += beforeGst;
      if (line.countable) {
        b.invoices.add(invoiceId);
        b.customers.add(customerId);
      }
    };

    let agg = bases.get(base);
    if (!agg) {
      agg = { ...emptyBucket(), packs: new Map(), buyers: new Map() };
      bases.set(base, agg);
    }
    add(agg);
    add(totals.oil);

    let pack = agg.packs.get(description);
    if (!pack) {
      const perUnit = qty > 0 && litres > 0 ? litres / qty : null;
      pack = { ...emptyBucket(), packLitresPerUnit: perUnit };
      agg.packs.set(description, pack);
    }
    add(pack);

    let buyer = agg.buyers.get(customerId);
    if (!buyer) {
      buyer = { ...emptyBucket(), customerName: str(line.customerName) };
      agg.buyers.set(customerId, buyer);
    }
    add(buyer);

    const match = productByName.get(normalizeName(base));
    add(bucketFor(brands, match?.brand ?? "Unmatched"));
    add(bucketFor(segments, match?.segment ?? "Unmatched"));
  }

  const toSku = ([base, agg]: [string, BaseAgg]) => ({
    name: base,
    // Catalogue-matched brand for this base product (null when unmatched) — lets
    // the Reports page filter the billed-SKU list by brand.
    brand: productByName.get(normalizeName(base))?.brand ?? null,
    ...bucketOut(agg),
    packs: [...agg.packs.entries()]
      .map(([description, pack]) => ({
        description,
        packLitresPerUnit: pack.packLitresPerUnit,
        ...bucketOut(pack),
      }))
      .sort((a, b) => b.litres - a.litres || b.quantity - a.quantity),
    topBuyers: [...agg.buyers.values()]
      .map((buyer) => ({ customerName: buyer.customerName, ...bucketOut(buyer) }))
      .sort((a, b) => b.beforeGst - a.beforeGst)
      .slice(0, 5),
  });

  const oils = [...bases.entries()].map(toSku);
  oils.sort((a, b) => b.litres - a.litres || b.beforeGst - a.beforeGst);

  // Six-month trend (`trend`) and its per-month returns (`returnTrend`) were
  // fetched in the Promise.all at the top of this function — see the note there.
  const returnByMonth = new Map<string, { litres: number; beforeGst: number }>();
  for (const r of returnTrend) {
    returnByMonth.set(str(r.month), {
      litres: num(r.litres),
      beforeGst: num(r.beforeGst),
    });
  }

  const mapRollup = (m: Map<string, Bucket>) =>
    [...m.entries()]
      .map(([name, bucket]) => ({ name, ...bucketOut(bucket) }))
      .sort((a, b) => b.beforeGst - a.beforeGst);

  return {
    oils,
    brands: mapRollup(brands),
    segments: mapRollup(segments),
    months: trend.map((m) => {
      const month = str(m.month);
      const ret = returnByMonth.get(month);
      return {
        month,
        litres: round2(num(m.litres) - (ret?.litres ?? 0)),
        beforeGst: round2(num(m.beforeGst) - (ret?.beforeGst ?? 0)),
      };
    }),
    totals: {
      litres: round2(totals.oil.litres),
      beforeGst: round2(totals.oil.beforeGst),
      invoices: totals.oil.invoices.size,
    },
  };
}
