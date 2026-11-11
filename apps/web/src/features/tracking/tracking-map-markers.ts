import type { MapMarker } from "vardhan-maps/react";
import { bucketColor, type BandMeta, type MapCustomer } from "@/features/dashboard/map/map-helpers";
import { customerDotPopup, customerPopupInner } from "@/features/dashboard/map/map-markers";
import { formatTime, litres, rupees } from "@/lib/format";
import type { TrackingCheckin } from "./tracking-api";

const PLANNED = "#16a34a"; // green flag — a planned beat visit
const UNPLANNED = "#ea580c"; // orange flag — an unplanned drop-in

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A flag glyph (green = planned, orange = unplanned), anchored at the pole base. */
function flagIcon(planned: boolean): string {
  const fill = planned ? PLANNED : UNPLANNED;
  return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 1.5px rgba(15,23,42,.35))">
    <line x1="5" y1="3" x2="5" y2="22" stroke="#334155" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M5 3 H18 L15 7 L18 11 H5 Z" fill="${fill}" stroke="#ffffff" stroke-width="0.8"/>
  </svg>`;
}

/** Base layer: every customer with coordinates as a small dot, coloured by its
 *  collection-dues ageing bucket (same palette as the dashboard map; neutral
 *  grey when no dues). Nothing shows on hover — a click opens the shared dues
 *  popup (name link, city · salesperson, "₹ due · bucket"). */
export function customerMarkers(customers: MapCustomer[], meta: BandMeta): MapMarker[] {
  return customers.map((c) => ({
    lat: c.lat,
    lng: c.lng,
    color: bucketColor(c.bucket),
    radius: 3,
    popup: customerDotPopup(c, meta),
  }));
}

/** One line describing the visit's outcomes: order litres + collections,
 *  each deep-linking to its detail page. "No order or collection" when empty. */
function outcomesHtml(c: TrackingCheckin): string {
  const rows: string[] = [];
  for (const o of c.orders) {
    const suffix = o.litres > 0 ? ` · ${litres(o.litres)} L` : "";
    rows.push(
      `<a href="/orders/${encodeURIComponent(o.id)}" style="color:#2563eb;text-decoration:none">Order ${esc(o.code)}${suffix}</a>`,
    );
  }
  for (const col of c.collections) {
    rows.push(
      `<a href="/collections/${col.id}" style="color:#15803d;text-decoration:none">Collected ${esc(
        rupees(col.amount),
      )}</a>`,
    );
  }
  if (rows.length === 0) {
    return `<div style="color:#94a3b8;font-size:12px;margin-top:4px">No order or collection</div>`;
  }
  return `<div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;font-size:12px">${rows.join(
    "",
  )}</div>`;
}

/** Visit highlights: the selected executive's check-ins as flag markers. For a
 *  visited customer this is the ONLY marker (its dues dot is dropped) — so the
 *  popup merges the full customer block (name link, city · salesperson, dues,
 *  activity chips) with, below a divider, the visit details (time +
 *  planned/unplanned + any order/collection made on the visit). The linked name
 *  at the top is the only "open customer" link. */
export function checkinMarkers(checkins: TrackingCheckin[], customersById: Map<string, MapCustomer>, meta: BandMeta): MapMarker[] {
  return checkins.map((c) => {
    const planned = c.planned === "planned";
    const badge = planned
      ? `<span style="color:${PLANNED};font-weight:600">Planned</span>`
      : `<span style="color:${UNPLANNED};font-weight:600">Unplanned</span>`;
    const matched = customersById.get(c.customerId);
    // Full customer block when we have the mapped customer; otherwise just the
    // linked name (still the only customer link — no separate button).
    const customerBlock = matched
      ? customerPopupInner(matched, meta)
      : `<a href="/customers/${encodeURIComponent(c.customerId)}" style="font-weight:700;font-size:13px;color:#2563eb;text-decoration:none">${esc(c.customerName)}</a>`;
    const popup = `<div style="min-width:200px">
      ${customerBlock}
      <div style="border-top:1px solid #e2e8f0;margin:8px 0"></div>
      <div style="color:#64748b;font-size:12px">${
        c.checkInAt ? `Checked in ${esc(formatTime(c.checkInAt))} · ` : ""
      }${badge}</div>
      ${outcomesHtml(c)}
    </div>`;
    return {
      lat: c.lat,
      lng: c.lng,
      icon: flagIcon(planned),
      iconSize: [24, 24],
      iconAnchor: [5, 22],
      popup,
    };
  });
}
