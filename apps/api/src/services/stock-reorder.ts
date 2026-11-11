import type { SqlClient } from "../lib/db";

/** A (godown, product, pack) balance touched by a just-committed stock movement. */
export interface ReorderKey {
  locationId: string;
  productId: string;
  packSizeLitres: number;
}

/** A push-notification payload for a newly-raised low-stock alert. */
export interface ReorderPush {
  title: string;
  body: string;
}

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}
const units = (n: number): string => `${n.toLocaleString("en-IN")} unit${n === 1 ? "" : "s"}`;

/**
 * Expo push tokens for every SUPER_ADMIN with a registered mobile device, so a
 * low-stock alert reaches them on the app the same way an invoice reaches an SE.
 */
export async function superAdminPushTokens(sql: SqlClient): Promise<string[]> {
  const rows = (await sql`
    /* reorder_superadmin_push_tokens */
    select pt.token
    from push_tokens pt
    where pt.user_id in (
      select ur.user_id from user_roles ur join roles r on r.id = ur.role_id where r.code = 'SUPER_ADMIN'
    )
  `) as Row[];
  return rows.map((r) => str(r.token)).filter(Boolean);
}

/**
 * The (godown, product, pack) SKUs an invoice's stock movements touched — the
 * ground-truth affected set for invoice edit/cancel, which reverse & re-apply
 * stock. Used so those paths can re-check reorder without re-deriving line data.
 */
export async function keysForInvoice(sql: SqlClient, invoiceId: string): Promise<ReorderKey[]> {
  const rows = (await sql`
    /* reorder_keys_for_invoice */
    select distinct location_id as "locationId", product_id as "productId", pack_size_litres as "packSizeLitres"
    from stock_movements
    where ref_type = 'invoice' and ref_id = ${invoiceId}::uuid
  `) as Row[];
  return rows.map((r) => ({ locationId: str(r.locationId), productId: str(r.productId), packSizeLitres: num(r.packSizeLitres) }));
}

/** Drop duplicate keys so one SKU is evaluated once per call. */
function dedupe(keys: ReorderKey[]): ReorderKey[] {
  const seen = new Set<string>();
  return keys.filter((k) => {
    const id = `${k.locationId}|${k.productId}|${k.packSizeLitres}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** The alert + de-dup-state writes (and optional push) for one scanned balance. */
function reorderRowActions(sql: SqlClient, r: Row): { stmts: ReturnType<SqlClient>[]; push?: ReorderPush } {
  const reorder = r.reorderLevel == null ? null : num(r.reorderLevel);
  if (reorder == null) return { stmts: [] }; // no threshold → never alert
  const qty = num(r.qtyUnits);
  const openAlertId = r.openAlertId == null ? null : str(r.openAlertId);
  const low = qty <= reorder;
  const locationId = str(r.locationId);
  const productId = str(r.productId);
  const pack = num(r.packSizeLitres);
  const name = str(r.productName);
  const godown = str(r.locationName);
  const packLabel = `${pack} L`;

  if (low && openAlertId == null) {
    // Downward crossing → raise one alert and remember it.
    const alertId = crypto.randomUUID();
    const severity = qty <= 0 ? "high" : "medium";
    const message = `${name} (${packLabel}) at ${godown} is low: ${units(qty)} on hand, at or below the reorder level of ${reorder}.`;
    return {
      stmts: [
        sql`
          /* reorder_alert_insert */
          insert into alerts (id, alert_type, severity, alert_message, recommended_action, status)
          values (${alertId}::uuid, 'low_stock', ${severity}, ${message}, 'Restock this SKU.', 'open')
        `,
        sql`
          /* reorder_state_arm */
          insert into stock_reorder_state (location_id, product_id, pack_size_litres, open_alert_id, updated_at)
          values (${locationId}::uuid, ${productId}::uuid, ${pack}, ${alertId}::uuid, now())
          on conflict (location_id, product_id, pack_size_litres)
            do update set open_alert_id = excluded.open_alert_id, updated_at = now()
        `,
      ],
      push: { title: "Low stock", body: `${name} (${packLabel}) at ${godown}: ${units(qty)} left — restock needed.` },
    };
  }

  if (!low && openAlertId != null) {
    // Restocked above reorder → auto-close the open alert and re-arm.
    return {
      stmts: [
        sql`
          /* reorder_alert_close */
          update alerts set status = 'closed', closed_at = now(), updated_at = now()
          where id = ${openAlertId}::uuid and status = 'open'
        `,
        sql`
          /* reorder_state_clear */
          update stock_reorder_state set open_alert_id = null, updated_at = now()
          where location_id = ${locationId}::uuid and product_id = ${productId}::uuid and pack_size_litres = ${pack}
        `,
      ],
    };
  }

  return { stmts: [] };
}

/**
 * Real-time low-stock guard. Given the (godown, product, pack) balances touched by
 * a just-committed stock movement, raise or clear low-stock alerts:
 *
 *  - `qty <= reorder_level` and no alert open yet  → create an OPEN `low_stock`
 *    alert and remember its id in `stock_reorder_state` (one alert per crossing).
 *  - `qty  > reorder_level` and an alert is open   → auto-close that alert and
 *    re-arm the SKU for the next crossing.
 *
 * SKUs with no `reorder_level` set are ignored. Alert + state writes run in one
 * batch (Neon HTTP driver). Returns the push payloads for the newly-raised
 * alerts so the caller can send them to the super admins' mobile app.
 */
export async function checkReorder(sql: SqlClient, keys: ReorderKey[]): Promise<ReorderPush[]> {
  const uniq = dedupe(keys);
  if (uniq.length === 0) return [];

  const rows = (await sql`
    /* reorder_scan */
    select sb.location_id as "locationId", sb.product_id as "productId", sb.pack_size_litres as "packSizeLitres",
           coalesce(sb.qty_units, 0) as "qtyUnits", sb.reorder_level as "reorderLevel",
           p.product_name as "productName", l.name as "locationName",
           st.open_alert_id as "openAlertId"
    from unnest(${uniq.map((k) => k.locationId)}::uuid[], ${uniq.map((k) => k.productId)}::uuid[], ${uniq.map((k) => k.packSizeLitres)}::numeric[])
         as k(location_id, product_id, pack_size_litres)
    join stock_balances sb
      on sb.location_id = k.location_id and sb.product_id = k.product_id and sb.pack_size_litres = k.pack_size_litres
    join products p on p.id = sb.product_id
    join stock_locations l on l.id = sb.location_id
    left join stock_reorder_state st
      on st.location_id = sb.location_id and st.product_id = sb.product_id and st.pack_size_litres = sb.pack_size_litres
  `) as Row[];

  const stmts: ReturnType<SqlClient>[] = [];
  const pushes: ReorderPush[] = [];
  for (const r of rows) {
    const { stmts: rowStmts, push } = reorderRowActions(sql, r);
    if (rowStmts.length > 0) stmts.push(...rowStmts);
    if (push) pushes.push(push);
  }

  if (stmts.length > 0) await sql.transaction(stmts);
  return pushes;
}
