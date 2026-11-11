import L from "leaflet";
import {
  rupees, bucketColor, bucketLabel, CLEAR_COLOR, orderChip, collectionChip,
  type ChipStyle, type MapCustomer,
} from "./map-helpers";
import { escapeHtml } from "./map-tooltip";

/** A small rounded staleness pill. */
function chipSpan(s: ChipStyle): string {
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9999px;font-size:11px;font-weight:600;background:${s.bg};color:${s.fg}">${escapeHtml(s.label)}</span>`;
}

/** The customer block's inner rows (no outer wrapper), so it can stand alone in a
 *  dues-dot popup OR lead the live-tracking map's merged visit popup:
 *  name (link to the customer page) + "city · assigned salesperson" + a dues line
 *  "₹<outstanding> due · <bucket label>" (₹ coloured by bucket, grey "No dues"),
 *  then last-order / last-collection activity chips. */
export function customerPopupInner(c: MapCustomer): string {
  const rows = [
    `<a href="/customers/${encodeURIComponent(c.id)}" style="font-weight:700;font-size:13px;color:#2563eb;text-decoration:none">${escapeHtml(c.name)}</a>`,
  ];
  const meta = [c.city, c.executiveName].filter(Boolean).map((s) => escapeHtml(String(s))).join(" · ");
  if (meta) rows.push(`<div style="font-size:12px;color:#475569;margin-top:3px">${meta}</div>`);
  rows.push(
    c.outstanding > 0
      ? `<div style="font-size:12px;margin-top:4px"><b style="color:${bucketColor(c.bucket)}">${escapeHtml(rupees(c.outstanding))}</b> due · ${escapeHtml(bucketLabel(c.bucket))}</div>`
      : `<div style="font-size:12px;margin-top:4px;color:${CLEAR_COLOR}">No dues</div>`,
  );
  rows.push(
    `<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;margin-top:6px">${chipSpan(orderChip(c.lastOrderDays))}${chipSpan(collectionChip(c.lastCollectionDays))}</div>`,
  );
  return rows.join("");
}

/** Standalone popup for a customer dot (shared by the dashboard + live-tracking maps). */
export function customerDotPopup(c: MapCustomer): string {
  return `<div style="min-width:190px">${customerPopupInner(c)}</div>`;
}

/** A small count badge at a district's centre — total customers in that district.
 *  Hover (title) reveals the district name + count. */
export function districtCountIcon(name: string, count: number) {
  return L.divIcon({
    className: "",
    html: `<span title="${escapeHtml(name)} — ${count} customer${count === 1 ? "" : "s"}" style="pointer-events:none;display:inline-block;min-width:14px;padding:1px 5px;border-radius:9999px;background:rgba(51,65,85,.85);color:#fff;font-size:10px;font-weight:700;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.35)">${count}</span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}
